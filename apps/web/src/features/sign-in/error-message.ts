import { ApiRequestError } from "@povod/api-client";

export function signInErrorKey(
  error: unknown,
): "invalid" | "validation" | "csrf" | "unavailable" | "network" | "rate" {
  if (!(error instanceof ApiRequestError)) return "network";
  if (error.status === 401) return "invalid";
  if (error.status === 422) return "validation";
  if (error.status === 403) return "csrf";
  if (error.status === 429) return "rate";
  return "unavailable";
}
