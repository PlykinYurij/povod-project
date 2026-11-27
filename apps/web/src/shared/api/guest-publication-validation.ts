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

function hasText(value: unknown, fields: readonly string[]): boolean {
  return (
    record(value) && fields.every((field) => typeof value[field] === "string")
  );
}

function isTogetherContent(content: Record<string, unknown>): boolean {
  return (
    (content.locale === "ru" || content.locale === "en") &&
    hasText(content.names, ["first", "second"]) &&
    hasText(content.event, ["date", "startTime", "timeZone"]) &&
    hasText(content.venue, ["name", "address"]) &&
    hasText(content.photo, ["alt"]) &&
    record(content.note) &&
    typeof content.note.enabled === "boolean" &&
    hasText(content.note, ["heading", "body"]) &&
    hasText(content.copy, [
      "heroLabel",
      "separator",
      "intro",
      "eventHeading",
      "dateLabel",
      "venueLabel",
      "photoHeading",
      "rsvpHeading",
      "rsvpIntro",
      "rsvpAction",
      "signoff",
    ])
  );
}

function isConfettiContent(content: Record<string, unknown>): boolean {
  return (
    (content.locale === "ru" || content.locale === "en") &&
    typeof content.celebrantName === "string" &&
    !("names" in content) &&
    hasText(content.event, ["date", "startTime", "timeZone"]) &&
    hasText(content.venue, ["name", "address"]) &&
    hasText(content.photo, ["alt"]) &&
    record(content.note) &&
    typeof content.note.enabled === "boolean" &&
    hasText(content.note, ["heading", "body"]) &&
    hasText(content.copy, [
      "invitationLabel",
      "intro",
      "whenHeading",
      "whereHeading",
      "dateLabel",
      "timeLabel",
      "photoHeading",
      "rsvpHeading",
      "rsvpIntro",
      "rsvpAction",
      "signoff",
    ])
  );
}

export function isGuestPublication(value: unknown): boolean {
  if (
    !record(value) ||
    (value.templateVersionId !== "wedding-garden-v1" &&
      value.templateVersionId !== "wedding-together-v1" &&
      value.templateVersionId !== "birthday-confetti-v1") ||
    typeof value.snapshotId !== "string" ||
    !isProjectId(value.snapshotId) ||
    !record(value.content)
  )
    return false;
  if (
    !record(value.rsvp) ||
    value.rsvp.formVersionId !== value.snapshotId ||
    value.rsvp.schema !== "garden-v1" ||
    value.rsvp.nameMaxLength !== 80 ||
    value.rsvp.maxCompanions !== 2
  )
    return false;
  const content = value.content;
  const together = value.templateVersionId === "wedding-together-v1";
  if (
    value.templateVersionId === "birthday-confetti-v1"
      ? !isConfettiContent(content) || "heroMediaId" in content
      : together
        ? !isTogetherContent(content) || "heroMediaId" in content
        : "photo" in content
  )
    return false;
  const photoId = record(content.photo)
    ? content.photo.mediaId
    : content.heroMediaId;
  if (value.cover === null) return photoId === null;
  return (
    record(value.cover) &&
    validDimension(value.cover.width) &&
    validDimension(value.cover.height) &&
    photoId === value.snapshotId
  );
}

export function isRsvpReceipt(value: unknown): boolean {
  return (
    record(value) &&
    typeof value.responseId === "string" &&
    isProjectId(value.responseId) &&
    typeof value.receivedAt === "string" &&
    Number.isFinite(Date.parse(value.receivedAt))
  );
}
