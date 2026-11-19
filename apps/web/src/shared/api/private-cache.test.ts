import { expect, test } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { clearPrivateQueries } from "./private-cache";

test("a late response from owner A cannot populate cache after switching owners", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let resolve!: (value: string) => void;
  const network = new Promise<string>((done) => {
    resolve = done;
  });
  const pending = client
    .fetchQuery({ queryKey: ["private", "A"], queryFn: () => network })
    .catch(() => undefined);
  await clearPrivateQueries(client);
  client.setQueryData(["private", "B"], "owner B");
  resolve("owner A");
  await pending;
  expect(client.getQueryData(["private", "A"])).toBeUndefined();
  expect(client.getQueryData(["private", "B"])).toBe("owner B");
  client.clear();
});
