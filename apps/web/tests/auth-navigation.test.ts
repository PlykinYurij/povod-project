import { expect, test } from "vitest";
import { loginHref, safeReturnTo } from "@shared/config/auth-navigation";

test("private destination keeps its query and fragment through login", () => {
  const destination = "/account?tab=saved#details";
  const url = new URL(loginHref(destination), "https://povod.invalid");
  expect(url.pathname).toBe("/login");
  expect(safeReturnTo(url.searchParams.get("returnTo"))).toBe(destination);
});

test.each([
  undefined,
  null,
  ["/account"],
  "https://example.test",
  "//example.test",
  "/\\example.test",
  "/login",
  "/account/../login",
  "/account\n",
  "/%61ccount",
  "/admin",
  "javascript:alert(1)",
])("untrusted returnTo falls back to account: %s", (value) => {
  expect(safeReturnTo(value)).toBe("/account");
});
