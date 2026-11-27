import { afterEach, expect, test, vi } from "vitest";
import { apiFetch } from "./transport";

afterEach(() => vi.unstubAllGlobals());

const id = "da24985f-fdac-4e97-a14f-e2dcb8c25ac6";
const path = `/api/v1/admin/projects/${id}/unpublish`;

test("resume accepts an authenticated POST and validates the published receipt", async () => {
  vi.stubGlobal("window", {});
  const resume = `/api/v1/admin/projects/${id}/resume`;
  const receipt = {
    publicationId: id,
    publicationVersion: 3,
    status: "PUBLISHED",
    expiresAt: "2027-01-01T10:00:00.000Z",
    remainingMs: null,
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
    .mockResolvedValueOnce(Response.json(receipt))
    .mockResolvedValueOnce(Response.json({ ...receipt, status: "PAUSED" }));
  vi.stubGlobal("fetch", request);
  await expect(apiFetch(resume)).rejects.toThrow("Resume only supports POST");
  const options = { method: "POST", headers: { "Idempotency-Key": id } };
  await expect(apiFetch(resume, options)).resolves.toEqual(receipt);
  expect(request.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe(
    "synthetic-csrf",
  );
  expect(request.mock.calls[1][1].headers.get("Idempotency-Key")).toBe(id);
  await expect(
    apiFetch(resume, {
      method: "POST",
      headers: { "X-CSRF-Token": "synthetic" },
    }),
  ).rejects.toMatchObject({ status: 503 });
});

test("the exact admin unpublish action uses browser credentials, CSRF and the caller's retry key", async () => {
  vi.stubGlobal("window", {});
  const receipt = {
    publicationId: id,
    publicationVersion: 2,
    status: "PAUSED",
    expiresAt: null,
    remainingMs: 24000,
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
    .mockResolvedValueOnce(Response.json(receipt));
  vi.stubGlobal("fetch", fetch);
  await expect(
    apiFetch(path, { method: "POST", headers: { "Idempotency-Key": id } }),
  ).resolves.toEqual(receipt);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][1]).toMatchObject({
    credentials: "include",
    cache: "no-store",
  });
  expect(fetch.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe(
    "synthetic-csrf",
  );
  expect(fetch.mock.calls[1][1].headers.get("Idempotency-Key")).toBe(id);
});

test("only POST to a bare ID is trusted, and malformed receipts are not treated as success", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ status: "PAUSED" }));
  vi.stubGlobal("fetch", fetch);
  await expect(apiFetch(path)).rejects.toThrow("Unpublish only supports POST");
  await expect(apiFetch(path + "?extra=1", { method: "POST" })).rejects.toThrow(
    "Untrusted API path",
  );
  await expect(
    apiFetch(path, {
      method: "POST",
      headers: { "X-CSRF-Token": "synthetic" },
    }),
  ).rejects.toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
