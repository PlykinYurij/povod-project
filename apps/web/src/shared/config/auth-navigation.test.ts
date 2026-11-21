import { expect, test } from "vitest";
import { loginHref, safeReturnTo } from "./auth-navigation";
import { newProjectHref, projectEditorHref } from "./project-navigation";

test("login accepts only the UUID-based project editor route", () => {
  const path = projectEditorHref("f729d400-0942-4633-9bc7-f33ffe78c422");
  expect(safeReturnTo(path)).toBe(path);
  expect(safeReturnTo("/projects/other/edit")).toBe("/account");
  expect(safeReturnTo(path + "/admin")).toBe("/account");
});

test("login keeps the selected template version", () => {
  const destination = newProjectHref("wedding-garden-v1");
  const parameters = new URL(loginHref(destination), "https://povod.invalid")
    .searchParams;
  expect(safeReturnTo(parameters.get("returnTo"))).toBe(destination);
});

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
