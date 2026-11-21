import { expect, test } from "vitest";
import { isAdminRequestPath } from "./admin-request-path";

const id = "f729d400-0942-4633-9bc7-f33ffe78c422";
const root = "/api/v1/admin/requests";

test("accepts only the queue, bounded cursor and specific request detail", () => {
  expect(isAdminRequestPath(root)).toBe(true);
  expect(isAdminRequestPath(root + "?after=" + id)).toBe(true);
  expect(isAdminRequestPath(root + "/" + id)).toBe(true);
  expect(isAdminRequestPath(root + "?after=" + id + "&after=" + id)).toBe(
    false,
  );
  expect(isAdminRequestPath(root + "?include=contacts")).toBe(false);
  expect(isAdminRequestPath(root + "/" + id + "?include=contacts")).toBe(false);
  expect(isAdminRequestPath(root + "/" + id + "/publish")).toBe(false);
  expect(isAdminRequestPath(root + "/not-an-id")).toBe(false);
});
