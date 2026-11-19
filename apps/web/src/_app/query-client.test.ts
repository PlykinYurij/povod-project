import { expect, test } from "vitest";
import { getQueryClient } from "./query-client";

test("server rendering never shares a private QueryClient between requests", () => {
  const ownerA = getQueryClient();
  const ownerB = getQueryClient();
  ownerA.setQueryData(["session"], { email: "a@example.test" });
  expect(ownerB).not.toBe(ownerA);
  expect(ownerB.getQueryData(["session"])).toBeUndefined();
  ownerA.clear();
  ownerB.clear();
});
