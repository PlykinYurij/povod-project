import { isProjectId } from "@shared/config/project-navigation";

export function isUnpublishReceipt(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const receipt = value as Record<string, unknown>;
  if (
    typeof receipt.publicationId !== "string" ||
    !isProjectId(receipt.publicationId) ||
    typeof receipt.publicationVersion !== "number" ||
    !Number.isSafeInteger(receipt.publicationVersion) ||
    receipt.publicationVersion < 1
  )
    return false;
  if (receipt.status === "PAUSED")
    return (
      receipt.expiresAt === null &&
      typeof receipt.remainingMs === "number" &&
      Number.isSafeInteger(receipt.remainingMs) &&
      receipt.remainingMs > 0
    );
  return (
    receipt.status === "UNPUBLISHED" &&
    receipt.remainingMs === null &&
    typeof receipt.expiresAt === "string" &&
    Number.isFinite(Date.parse(receipt.expiresAt))
  );
}
