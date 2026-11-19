import { expect, test } from "vitest";
import {
  validNewPassword,
  validEmailCode,
  passwordRules,
  validEmail,
  validDisplayName,
  passwordsMatch,
} from "../src/shared/lib/identity-validation";
import {
  hasFieldError,
  identityErrorKey,
  hasInlineFieldErrors,
} from "../src/shared/api/identity-errors";
import { ApiRequestError } from "@povod/api-client";

test.each(["Abcdef1!", "A1!" + "a".repeat(125)])(
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
  " Abcdef1!",
  "Abc def1!",
  "Abcdef1! ",
  "Пароль1!",
  "Abcdéfg1!",
  "Abcdef1!\n",
  "Abcdef1!😀",
  "A1!" + "a".repeat(126),
])("new password rejects missing rules or non-ASCII: %s", (value) => {
  expect(validNewPassword(value)).toBe(false);
});

test("password checklist tells exactly what is missing", () => {
  expect(passwordRules("abcdefgh")).toEqual({
    length: true,
    latin: true,
    uppercase: false,
    digit: false,
    special: false,
    noSpaces: true,
  });
  expect(Object.values(passwordRules("Abcdef1!")).every(Boolean)).toBe(true);
  expect(passwordRules("Abc def1!").noSpaces).toBe(false);
});
test("repeated passwords must match exactly without normalization", () => {
  expect(passwordsMatch("Abcdef1!", "Abcdef1!")).toBe(true);
  expect(passwordsMatch("Abcdef1!", "Abcdef1! ")).toBe(false);
  expect(passwordsMatch("", "")).toBe(false);
});
test("inline validation catches malformed emails and missing names", () => {
  expect(validEmail("test")).toBe(false);
  expect(validEmail("test@example.test")).toBe(true);
  for (const name of ["", "   ", "A".repeat(81), "Имя\nФамилия"])
    expect(validDisplayName(name)).toBe(false);
  expect(validDisplayName(" Андрей ")).toBe(true);
  expect(validDisplayName("Анна-Мария")).toBe(true);
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
  expect(hasInlineFieldErrors(error, ["newPassword", "code"])).toBe(true);
  expect(hasInlineFieldErrors(error, ["email"])).toBe(false);
  expect(
    hasInlineFieldErrors(new ApiRequestError(422, "VALIDATION_FAILED"), [
      "email",
    ]),
  ).toBe(false);
});
