import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Readable } from "node:stream";
import { ApiError } from "../../http/api-error";
import { MAX_PHOTO_BYTES } from "./photo-input";

function unavailable() {
  return new ApiError(
    503,
    "PHOTO_STORAGE_UNAVAILABLE",
    "Хранилище фото временно недоступно",
  );
}

export function originalPhotoKey(projectId: string, photoId: string): string {
  return `projects/${projectId}/photos/${photoId}/original`;
}

export function photoRenditionKey(
  projectId: string,
  photoId: string,
  token: string,
  size: "display" | "thumb",
): string {
  return `projects/${projectId}/photos/${photoId}/renditions/${token}/${size}.webp`;
}

@Injectable()
export class PhotoStorage implements OnModuleDestroy {
  private target?: { bucket: string; client: S3Client };

  private configuredTarget() {
    if (this.target) return this.target;
    const bucket = process.env.MEDIA_S3_BUCKET;
    const region = process.env.MEDIA_S3_REGION;
    const address = process.env.MEDIA_S3_ENDPOINT;
    if (!bucket || !region || !address) throw unavailable();
    let endpoint: URL;
    try {
      endpoint = new URL(address);
    } catch {
      throw unavailable();
    }
    const localHttp =
      process.env.NODE_ENV !== "production" &&
      endpoint.protocol === "http:" &&
      endpoint.hostname === "127.0.0.1";
    if (
      (!localHttp && endpoint.protocol !== "https:") ||
      endpoint.origin !== address ||
      endpoint.username ||
      endpoint.password
    )
      throw unavailable();
    this.target = {
      bucket,
      client: new S3Client({
        region,
        endpoint: address,
        forcePathStyle: true,
        maxAttempts: 1,
      }),
    };
    return this.target;
  }

  assertConfigured(): void {
    this.configuredTarget();
  }

  async readObject(key: string): Promise<Buffer> {
    const { bucket, client } = this.configuredTarget();
    const deadline = AbortSignal.timeout(15_000);
    try {
      const { Body, ContentLength } = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { abortSignal: deadline },
      );
      if (!(Body instanceof Readable)) throw unavailable();
      const abort = () => Body.destroy(new Error("Media read deadline"));
      deadline.addEventListener("abort", abort, { once: true });
      try {
        if (
          deadline.aborted ||
          (ContentLength !== undefined && ContentLength > MAX_PHOTO_BYTES)
        )
          throw unavailable();
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of Body) {
          if (!Buffer.isBuffer(chunk)) throw unavailable();
          size += chunk.length;
          if (size > MAX_PHOTO_BYTES) throw unavailable();
          chunks.push(chunk);
        }
        if (ContentLength !== undefined && ContentLength !== size)
          throw unavailable();
        return Buffer.concat(chunks, size);
      } finally {
        deadline.removeEventListener("abort", abort);
        Body.destroy();
      }
    } catch {
      throw unavailable();
    }
  }

  async putWebp(key: string, bytes: Buffer): Promise<void> {
    await this.put(key, bytes, "image/webp");
  }

  async putOriginal(
    key: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.put(key, bytes, contentType);
  }

  private async put(
    key: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void> {
    const { bucket, client } = this.configuredTarget();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          ContentLength: bytes.length,
          CacheControl: "no-store",
        }),
        { abortSignal: AbortSignal.timeout(15_000) },
      );
    } catch {
      throw unavailable();
    }
  }

  onModuleDestroy(): void {
    this.target?.client.destroy();
  }
}
