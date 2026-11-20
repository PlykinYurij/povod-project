import type { ValidationError } from "class-validator";
import type { FieldErrorDto } from "./api-error";

/** Return field paths only: never echo raw content, passwords or validator messages. */
export function validationFields(
  errors: ValidationError[],
  prefix = "",
): FieldErrorDto[] {
  return errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const own = error.constraints
      ? [
          {
            path,
            code: error.constraints.whitelistValidation
              ? "UNKNOWN_FIELD"
              : "INVALID_VALUE",
          },
        ]
      : [];
    return [...own, ...validationFields(error.children ?? [], path)];
  });
}

/** class-transformer skips these keys before whitelist validation; reject instead of silently dropping them. */
export function reservedFieldErrors(
  input: unknown,
  prefix = "",
): FieldErrorDto[] {
  if (input === null || typeof input !== "object") return [];
  return Object.entries(input).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (key === "__proto__" || key === "constructor")
      return [{ path, code: "UNKNOWN_FIELD" }];
    return reservedFieldErrors(value, path);
  });
}
