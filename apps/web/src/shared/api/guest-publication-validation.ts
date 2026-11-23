import { isProjectId } from "@shared/config/project-navigation";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safePublicationUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      url.href === value
    );
  } catch {
    return false;
  }
}

export function isPublicationReceipt(value: unknown): boolean {
  return (
    record(value) &&
    typeof value.snapshotId === "string" &&
    isProjectId(value.snapshotId) &&
    typeof value.publicationId === "string" &&
    isProjectId(value.publicationId) &&
    safePublicationUrl(value.url) &&
    typeof value.requestVersion === "number" &&
    Number.isSafeInteger(value.requestVersion) &&
    typeof value.publishedAt === "string" &&
    Number.isFinite(Date.parse(value.publishedAt)) &&
    typeof value.expiresAt === "string" &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
}

function validDimension(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 1600
  );
}

export function isGuestPublication(value: unknown): boolean {
  if (
    !record(value) ||
    value.templateVersionId !== "wedding-garden-v1" ||
    typeof value.snapshotId !== "string" ||
    !isProjectId(value.snapshotId) ||
    !record(value.content)
  )
    return false;
  if (value.cover === null) return value.content.heroMediaId === null;
  return (
    record(value.cover) &&
    validDimension(value.cover.width) &&
    validDimension(value.cover.height) &&
    value.content.heroMediaId === value.snapshotId
  );
}
