import { createHash, randomBytes } from "node:crypto";
export const randomAuthToken = (): string => randomBytes(32).toString("hex");
export const hashAuthToken = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
