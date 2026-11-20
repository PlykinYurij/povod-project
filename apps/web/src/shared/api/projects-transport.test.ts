import { afterEach, expect, test, vi } from "vitest";
import { apiFetch } from "./transport";
import { createProject, getProject } from "./generated/http";

afterEach(() => vi.unstubAllGlobals());
const id = "da24985f-fdac-4e97-a14f-e2dcb8c25ac6";

test("private project GET forwards only the caller's explicit server cookie and uses no-store", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json({ id }));
  vi.stubGlobal("fetch", fetch);
  await getProject(id, {
    headers: { Cookie: "synthetic-owner-session" },
  });
  expect(fetch.mock.calls[0][1]).toMatchObject({
    credentials: "include",
    cache: "no-store",
  });
  expect(fetch.mock.calls[0][1].headers.get("Cookie")).toBe(
    "synthetic-owner-session",
  );
  await getProject(id);
  expect(fetch.mock.calls[1][1].headers.has("Cookie")).toBe(false);
});

test("project PATCH bootstraps browser CSRF and does not retry revision conflicts", async () => {
  vi.stubGlobal("window", {});
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
    .mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "REVISION_CONFLICT",
            fields: [{ path: "content.names.first", code: "INVALID_VALUE" }],
          },
        },
        { status: 409 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    apiFetch(`/api/v1/projects/${id}/draft`, {
      method: "PATCH",
      body: JSON.stringify({ expectedRevision: 1 }),
    }),
  ).rejects.toMatchObject({ status: 409, code: "REVISION_CONFLICT" });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe(
    "synthetic-csrf",
  );
  expect(fetch.mock.calls[1][1].method).toBe("PATCH");
});

test("create preserves the caller's idempotency key without generating a replacement", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ id }));
  vi.stubGlobal("fetch", fetch);
  await createProject(
    {
      templateVersionId: "wedding-garden-v1",
      title: "Наш день",
    },
    { headers: { "X-CSRF-Token": "synthetic", "Idempotency-Key": id } },
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1].headers.get("Idempotency-Key")).toBe(id);
});

test("project routes do not widen trusted paths or enable unsupported mutations", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const path of [
    "/api/v1/projects?ownerId=other",
    `/api/v1/projects/${id}/publish`,
    `/api/v1/projects/${id}/../auth/session`,
    `/api/v1/projects/${id}%2Fdraft`,
    `/api/v1/projects/${id}/draft?ownerId=other`,
    "/api/v1/projects/invalid-id",
  ])
    await expect(apiFetch(path)).rejects.toThrow("Untrusted API path");
  for (const [path, method] of [
    ["/api/v1/projects", "DELETE"],
    [`/api/v1/projects/${id}`, "PATCH"],
    [`/api/v1/projects/${id}/draft`, "GET"],
  ])
    await expect(apiFetch(path, { method })).rejects.toThrow(
      "Unsupported project method",
    );
  expect(fetch).not.toHaveBeenCalled();
});

test("server project mutations require explicit CSRF instead of a shared browser context", async () => {
  await expect(
    apiFetch(`/api/v1/projects/${id}/draft`, { method: "PATCH" }),
  ).rejects.toThrow("request-scoped CSRF");
});
