import { afterEach, expect, test, vi } from "vitest";
import { templateCatalogFixture } from "@shared/lib/testing/template-catalog-fixture";
import { loadCatalog } from "./load-catalog";

afterEach(() => vi.unstubAllGlobals());
test("real generated method uses requested locale, omits credentials and keeps an abort signal", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json(templateCatalogFixture()));
  vi.stubGlobal("fetch", fetch);
  const result = await loadCatalog("en");
  expect(result.kind).toBe("ready");
  expect(fetch.mock.calls[0][0]).toContain("/api/v1/templates?locale=en");
  expect(fetch.mock.calls[0][1].credentials).toBe("omit");
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
test("a successful empty response remains distinct from an error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ items: [] })),
  );
  expect(await loadCatalog("ru")).toEqual({ kind: "ready", items: [] });
});
test.each(["network", "timeout", "bad-response", "unavailable"])(
  "failure state is safe and never claims an empty catalog: %s",
  async (failure) => {
    const fetch = vi.fn();
    if (failure === "network")
      fetch.mockRejectedValue(new TypeError("fetch failed"));
    else if (failure === "timeout")
      fetch.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    else if (failure === "bad-response")
      fetch.mockResolvedValue(
        Response.json({ items: [{ demoPath: "javascript:alert(1)" }] }),
      );
    else
      fetch.mockResolvedValue(
        Response.json(
          {
            error: { code: "SERVICE_UNAVAILABLE", message: "private details" },
          },
          { status: 503 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await loadCatalog("ru")).toEqual({ kind: "unavailable" });
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
