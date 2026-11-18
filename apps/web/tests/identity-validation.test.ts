import { expect, test } from "vitest";
import {
  validNewPassword,
  validEmailCode,
} from "../src/shared/lib/identity-validation";
import {
  hasFieldError,
  identityErrorKey,
} from "../src/shared/api/identity-errors";
import { ApiRequestError } from "@povod/api-client";

test.each(["Abcdef1!", " A1!    ", "A1!" + "a".repeat(125)])(
  "new password accepts D-28 boundaries",
  (value) => {
    expect(validNewPassword(value)).toBe(true);
  },
);
test.each([
  "Abcd1!",
  "abcdef1!",
  "Abcdefgh!",
  "Abcdef12",
  "Abcdef1 ",
  "Пароль1!",
  "Abcdéfg1!",
  "Abcdef1!\n",
  "Abcdef1!😀",
  "A1!" + "a".repeat(126),
])("new password rejects missing rules or non-ASCII: %s", (value) => {
  expect(validNewPassword(value)).toBe(false);
});
test("email codes preserve leading zeros and reject number-like input", () => {
  expect(validEmailCode("000123")).toBe(true);
  for (const value of [
    "12345",
    "1234567",
    "123 45",
    "１２３４５６",
    "1e0000",
    "123456\n",
  ])
    expect(validEmailCode(value)).toBe(false);
});
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
});
