export function trustedApiOrigin(useInternal = false): string {
  const origin =
    (useInternal ? process.env.POVOD_INTERNAL_API_ORIGIN : undefined) ??
    process.env.NEXT_PUBLIC_API_ORIGIN ??
    "http://127.0.0.1:3001";
  const url = new URL(origin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== origin ||
    url.username ||
    url.password
  ) {
    throw new Error("API origin must be an exact trusted HTTP(S) origin");
  }
  return origin;
}
