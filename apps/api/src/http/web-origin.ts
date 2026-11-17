export function webOrigin(): string | undefined {
  const origin =
    process.env.WEB_ORIGIN ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "http://127.0.0.1:3000");
  if (!origin) return undefined;
  const parsed = new URL(origin);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.origin !== origin
  )
    throw new Error("WEB_ORIGIN must be an exact HTTP(S) origin without path.");
  return origin;
}
