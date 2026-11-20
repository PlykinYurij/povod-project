import { isUUID } from "class-validator";
import { ApiError } from "./api-error";

export function readIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !isUUID(value)) {
    throw new ApiError(422, "VALIDATION_FAILED", "Передайте ключ повтора", [
      { path: "idempotencyKey", code: "INVALID_VALUE" },
    ]);
  }
  return value;
}

export function rejectUnknownQuery(query: Record<string, unknown>): void {
  const fields = Object.keys(query).map((path) => ({
    path,
    code: "UNKNOWN_FIELD",
  }));
  if (fields.length) {
    throw new ApiError(
      422,
      "VALIDATION_FAILED",
      "Неизвестные параметры",
      fields,
    );
  }
}
