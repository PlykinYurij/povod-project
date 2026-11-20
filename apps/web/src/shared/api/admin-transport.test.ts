import { afterEach, expect, test, vi } from "vitest";
import { apiFetch } from "./transport";
import { getAdminAccess } from "./generated/http";

afterEach(() => vi.unstubAllGlobals());

test("admin access forwards only request-scoped context with no-store", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ role: "ADMIN" }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    getAdminAccess({
      headers: { Cookie: "synthetic-session" },
    }),
  ).resolves.toEqual({ role: "ADMIN" });
  expect(fetch).toHaveBeenCalledTimes(1);
  const options = fetch.mock.calls[0][1];
  expect(options.cache).toBe("no-store");
  expect(options.credentials).toBe("include");
  expect(options.headers.get("Cookie")).toBe("synthetic-session");
});

test("admin route allowlist cannot be widened to mutations, queries or other admin paths", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    apiFetch("/api/v1/admin/access", { method: "POST" }),
  ).rejects.toThrow("read-only");
  for (const path of [
    "/api/v1/admin/access?role=ADMIN",
    "/api/v1/admin/projects",
    "/api/v1/admin/access/../projects",
  ]) {
    await expect(apiFetch(path)).rejects.toThrow("Untrusted API path");
  }
  expect(fetch).not.toHaveBeenCalled();
});

test("denied and malformed responses never imply administrative access", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ error: { code: "ADMIN_REQUIRED" } }, { status: 403 }),
    )
    .mockResolvedValueOnce(Response.json({ role: "USER" }));
  vi.stubGlobal("fetch", fetch);
  await expect(apiFetch("/api/v1/admin/access")).rejects.toMatchObject({
    status: 403,
    code: "ADMIN_REQUIRED",
  });
  await expect(apiFetch("/api/v1/admin/access")).rejects.toMatchObject({
    status: 503,
    code: "SERVICE_UNAVAILABLE",
  });
});
