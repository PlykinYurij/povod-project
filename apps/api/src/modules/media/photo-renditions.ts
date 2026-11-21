import sharp from "sharp";
import { inspectPhoto, MAX_PHOTO_PIXELS } from "./photo-input";

export class InvalidPhoto extends Error {}

async function webp(bytes: Buffer, bound: number) {
  return sharp(bytes, {
    limitInputPixels: MAX_PHOTO_PIXELS,
    failOn: "warning",
    sequentialRead: true,
  })
    .autoOrient()
    .resize({
      width: bound,
      height: bound,
      fit: "inside",
      withoutEnlargement: true,
    })
    .timeout({ seconds: 10 })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
}

export async function renderPhoto(
  bytes: Buffer,
  expected: {
    sha256: string;
    byteSize: number;
    mime: string;
  },
) {
  try {
    const input = await inspectPhoto(bytes);
    if (
      input.sha256 !== expected.sha256 ||
      input.byteSize !== expected.byteSize ||
      input.mime !== expected.mime
    )
      throw new InvalidPhoto();
    const display = await webp(bytes, 1600);
    const thumb = await webp(bytes, 480);
    return { display, thumb };
  } catch {
    throw new InvalidPhoto();
  }
}
