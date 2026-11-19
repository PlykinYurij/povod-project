import { expect, test } from "vitest";
import {
  hasFieldError,
  identityErrorKey,
  hasInlineFieldErrors,
} from "./identity-errors";
import { ApiRequestError } from "./transport";

test("lost confirmation is uncertain; rejected confirmations remain specific", () => {
  expect(identityErrorKey(new TypeError("fetch failed"), true)).toBe(
    "uncertain",
  );
  expect(
    identityErrorKey(new ApiRequestError(503, "SERVICE_UNAVAILABLE"), true),
  ).toBe("uncertain");
  expect(
    identityErrorKey(new ApiRequestError(503, "SERVICE_UNAVAILABLE")),
  ).toBe("unavailable");
  expect(
    identityErrorKey(new ApiRequestError(400, "RESET_CODE_INVALID"), true),
  ).toBe("invalidCode");
  expect(
    identityErrorKey(
      new ApiRequestError(400, "REGISTRATION_CODE_INVALID"),
      true,
    ),
  ).toBe("invalidCode");
  expect(identityErrorKey(new ApiRequestError(429, "RATE_LIMITED"), true)).toBe(
    "rate",
  );
  expect(identityErrorKey(new ApiRequestError(409, "EMAIL_UNAVAILABLE"))).toBe(
    "emailUnavailable",
  );
});

test("server field errors map only to their exact field", () => {
  const error = new ApiRequestError(422, "VALIDATION_FAILED", [
    { path: "newPassword", code: "INVALID_VALUE" },
  ]);
  expect(hasFieldError(error, "newPassword")).toBe(true);
  expect(hasFieldError(error, "password")).toBe(false);
  expect(hasFieldError(new Error("newPassword"), "newPassword")).toBe(false);
  expect(hasInlineFieldErrors(error, ["newPassword", "code"])).toBe(true);
  expect(hasInlineFieldErrors(error, ["email"])).toBe(false);
  expect(
    hasInlineFieldErrors(new ApiRequestError(422, "VALIDATION_FAILED"), [
      "email",
    ]),
  ).toBe(false);
});
