import { afterEach, expect, test, vi } from "vitest";
import { apiFetch } from "./transport";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const guestPath = "/api/v1/public/invitations/by-address/quiet-garden";
const id = "62654033-a24e-48c1-aec0-26122499f18a";

test("guest reads use the configured upstream, strip credentials and reject redirects", async () => {
  vi.stubEnv("POVOD_INTERNAL_API_ORIGIN", "http://127.0.0.1:4000");
  const fetchFake = vi.fn().mockResolvedValue(
    Response.json({
      templateVersionId: "wedding-garden-v1",
      snapshotId: id,
      content: { heroMediaId: null },
      cover: null,
      rsvp: {
        formVersionId: id,
        schema: "garden-v1",
        nameMaxLength: 80,
        maxCompanions: 2,
      },
    }),
  );
  vi.stubGlobal("fetch", fetchFake);
  await apiFetch(guestPath, {
    headers: {
      Cookie: "synthetic-cookie",
      Authorization: "synthetic-auth",
      "X-CSRF-Token": "synthetic-csrf",
    },
  });
  const [url, options] = fetchFake.mock.calls[0];
  expect(url).toBe("http://127.0.0.1:4000" + guestPath);
  expect(options).toMatchObject({
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
  expect([...options.headers.keys()]).toEqual([]);
  await expect(apiFetch(guestPath + "/cover/" + id + "?raw=1")).rejects.toThrow(
    "Untrusted API path",
  );
  await expect(apiFetch(guestPath, { method: "POST" })).rejects.toThrow(
    "read-only",
  );
  expect(fetchFake).toHaveBeenCalledTimes(1);
});

test("the browser posts through its own guest address without cookies or a CSRF bootstrap", async () => {
  vi.stubGlobal("window", {});
  const fetchFake = vi.fn().mockResolvedValue(
    Response.json(
      {
        responseId: id,
        receivedAt: "2026-11-23T00:00:00.000Z",
      },
      { status: 201 },
    ),
  );
  vi.stubGlobal("fetch", fetchFake);
  await apiFetch(guestPath + "/rsvp", {
    method: "POST",
    headers: {
      Cookie: "synthetic",
      Authorization: "synthetic",
      "Idempotency-Key": id,
    },
    body: "{}",
  });
  expect(fetchFake).toHaveBeenCalledTimes(1);
  const [url, options] = fetchFake.mock.calls[0];
  expect(url).toBe("/rsvp");
  expect(options).toMatchObject({
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
  expect(options.headers.get("Cookie")).toBeNull();
  expect(options.headers.get("X-CSRF-Token")).toBeNull();
  expect(options.headers.get("Idempotency-Key")).toBe(id);
});
