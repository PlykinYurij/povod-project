import type { ServiceRequestReceiptDto } from "./generated/models";

export function isRequestTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value))
  );
}

/** A public receipt must never accidentally expose a private ORM/contact payload. */
export function isServiceRequestReceipt(
  value: unknown,
): value is ServiceRequestReceiptDto {
  if (
    typeof value !== "object" ||
    value === null ||
    !("requestId" in value) ||
    !("status" in value) ||
    !("createdAt" in value)
  )
    return false;
  return (
    Object.keys(value).length === 3 &&
    typeof value.requestId === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value.requestId,
    ) &&
    value.status === "RECEIVED" &&
    isRequestTimestamp(value.createdAt)
  );
}
