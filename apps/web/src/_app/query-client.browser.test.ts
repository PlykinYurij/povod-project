// @vitest-environment jsdom
import { expect, test } from "vitest";
import { getQueryClient } from "./query-client";
test("browser QueryClient survives provider rerenders without becoming a server singleton", () => {
  expect(getQueryClient()).toBe(getQueryClient());
});
