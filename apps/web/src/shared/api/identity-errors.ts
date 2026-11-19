import { ApiRequestError } from "./transport";

export function identityErrorKey(error: unknown, confirming = false) {
  if (!(error instanceof ApiRequestError))
    return confirming ? "uncertain" : "network";
  if (error.status === 429) return "rate";
  if (error.status === 409) return "emailUnavailable";
  if (
    error.code === "REGISTRATION_CODE_INVALID" ||
    error.code === "RESET_CODE_INVALID"
  )
    return "invalidCode";
  if (error.status === 422) return "validation";
  if (error.status === 403) return "csrf";
  // A failed proxy/transport response cannot prove that confirm did not commit.
  return confirming && error.status >= 500 ? "uncertain" : "unavailable";
}

export function hasFieldError(error: unknown, path: string): boolean {
  return (
    error instanceof ApiRequestError &&
    error.fields.some((field) => field.path === path)
  );
}

export function hasInlineFieldErrors(
  error: unknown,
  paths: readonly string[],
): boolean {
  return (
    error instanceof ApiRequestError &&
    error.status === 422 &&
    error.fields.length > 0 &&
    error.fields.every((field) => paths.includes(field.path))
  );
}
