import sharp from "sharp";
import { createHash } from "node:crypto";
import { ApiError } from "../../http/api-error";

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 40_000_000;
export const MAX_PROJECT_PHOTOS = 10;

const formats = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

function signature(bytes: Buffer): keyof typeof formats | undefined {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return "jpeg";
  if (
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "png";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  return undefined;
}

export function photoDigest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function inspectPhoto(bytes: Buffer) {
  if (bytes.length > MAX_PHOTO_BYTES)
    throw new ApiError(413, "BODY_TOO_LARGE", "Фото превышает 15 МиБ");
  const format = signature(bytes);
  if (!format)
    throw new ApiError(
      415,
      "PHOTO_FORMAT_UNSUPPORTED",
      "Выберите JPEG, PNG или WebP",
    );
  const image = await sharp(bytes, {
    limitInputPixels: MAX_PHOTO_PIXELS,
    failOn: "warning",
  })
    .metadata()
    .catch(() => undefined);
  if (
    !image ||
    image.format !== format ||
    !image.width ||
    !image.height ||
    (image.pages ?? 1) !== 1
  )
    throw new ApiError(
      422,
      "PHOTO_INVALID",
      "Не удалось прочитать неподвижное фото",
    );
  if (image.width * image.height > MAX_PHOTO_PIXELS)
    throw new ApiError(
      422,
      "PHOTO_PIXELS_EXCEEDED",
      "Фото превышает 40 мегапикселей",
    );
  return {
    mime: formats[format],
    width: image.width,
    height: image.height,
    byteSize: bytes.length,
    sha256: photoDigest(bytes),
  };
}
