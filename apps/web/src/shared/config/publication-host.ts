export const PUBLICATION_SLUG = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOST = /^([a-z0-9.-]+)(?::([0-9]{1,5}))?$/i;
const PLATFORM_LABELS = new Set(["app", "admin", "www"]);
const RESERVED_LABELS = new Set(["mail", "api", "support"]);

type Surface =
  | { kind: "platform" | "invalid" }
  | { kind: "guest"; slug: string; hostname: string };

export function publicationSurface(host: string | null): Surface {
  const domain = process.env.PUBLIC_INVITATION_BASE_DOMAIN;
  if (!domain) return { kind: "platform" };
  if (
    domain.length > 253 ||
    !domain.includes(".") ||
    !domain.split(".").every((label) => DNS_LABEL.test(label))
  ) {
    return { kind: "invalid" };
  }
  const match = host?.match(HOST);
  const hostname = match?.[1].toLowerCase();
  const port = match?.[2] ? Number(match[2]) : undefined;
  if (
    !hostname ||
    hostname.length > 253 ||
    (port !== undefined && (port < 1 || port > 65535))
  )
    return { kind: "invalid" };
  if (
    hostname === domain ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return { kind: "platform" };
  }
  if (!hostname.endsWith("." + domain)) return { kind: "invalid" };
  const slug = hostname.slice(0, -(domain.length + 1));
  if (PLATFORM_LABELS.has(slug)) return { kind: "platform" };
  const extra = process.env.PUBLIC_INVITATION_RESERVED_SLUGS?.split(",").map(
    (label) => label.trim().toLowerCase(),
  );
  if (
    !PUBLICATION_SLUG.test(slug) ||
    RESERVED_LABELS.has(slug) ||
    extra?.includes(slug)
  ) {
    return { kind: "invalid" };
  }
  return { kind: "guest", slug, hostname };
}
