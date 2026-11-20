import { ApiError, type FieldErrorDto } from "../../http/api-error";

/** PostgreSQL JSONB cannot represent NUL or lone surrogates; reject without changing author text. */
export function assertStorableContent(value: unknown): void {
  const errors: FieldErrorDto[] = [];
  function visit(item: unknown, path: string): void {
    if (
      typeof item === "string" &&
      (item.includes("\u0000") ||
        Buffer.from(item, "utf8").toString("utf8") !== item)
    )
      errors.push({ path, code: "INVALID_VALUE" });
    else if (item !== null && typeof item === "object")
      for (const [key, nested] of Object.entries(item))
        visit(nested, path ? `${path}.${key}` : key);
  }
  visit(value, "");
  if (errors.length)
    throw new ApiError(422, "VALIDATION_FAILED", "Проверьте поля", errors);
}
