import { createHash, createHmac, randomBytes } from "node:crypto";

const localSecret = randomBytes(32);

export function requestPayloadHash(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function publicationKeyHash(actorId: string, key: string): string {
  return requestPayloadHash([
    "publication",
    actorId.toLowerCase(),
    key.toLowerCase(),
  ]);
}

export function assistanceKeyHash(key: string): string {
  return createHash("sha256")
    .update(JSON.stringify(["assistance", key.toLowerCase()]))
    .digest("hex");
}

export function requestRateSecret(): Buffer {
  const secret = process.env.SERVICE_REQUEST_RATE_SECRET;
  if (secret && !/^(?:[a-f0-9]{2}){32,}$/i.test(secret)) {
    throw new Error(
      "SERVICE_REQUEST_RATE_SECRET requires at least 32 random bytes in hex",
    );
  }
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SERVICE_REQUEST_RATE_SECRET is required in production");
  }
  return secret ? Buffer.from(secret, "hex") : localSecret;
}

export function requestRateKey(
  secret: Buffer,
  scope: "ip" | "phone",
  value: string,
): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify(["service-request-v1", scope, value]))
    .digest("hex");
}
