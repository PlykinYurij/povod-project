import { ApiError } from "../../http/api-error";

export const PUBLICATION_SLUG = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

const BUILT_IN_NAMES = new Set([
  "app",
  "admin",
  "www",
  "api",
  "mail",
  "support",
]);
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function publicationUrl(slug: string): string {
  const domain = process.env.PUBLIC_INVITATION_BASE_DOMAIN;
  if (
    !domain ||
    domain.length > 253 ||
    !domain.includes(".") ||
    !domain.split(".").every((label) => DOMAIN_LABEL.test(label)) ||
    !/^[a-z]/.test(domain.split(".").at(-1) ?? "")
  ) {
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Домен публикации не настроен",
    );
  }
  const reserved = process.env.PUBLIC_INVITATION_RESERVED_SLUGS?.split(",").map(
    (name) => name.trim().toLowerCase(),
  );
  if (
    BUILT_IN_NAMES.has(slug) ||
    reserved?.includes(slug) ||
    slug.length + domain.length + 1 > 253
  ) {
    throw new ApiError(422, "VALIDATION_FAILED", "Выберите другое имя адреса", [
      { path: "slug", code: "INVALID_VALUE" },
    ]);
  }
  return `https://${slug}.${domain}/`;
}
