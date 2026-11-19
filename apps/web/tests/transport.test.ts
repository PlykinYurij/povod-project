import { afterEach, expect, test, vi } from "vitest";
import {
  apiFetch,
  ApiRequestError,
} from "../../../packages/api-client/src/transport";

afterEach(() => vi.unstubAllGlobals());
test("invalid display name payload cannot reach the greeting", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          user: {
            id: "synthetic",
            email: "owner@example.test",
            displayName: { unexpected: true },
          },
        }),
      ),
  );
  await expect(apiFetch("/api/v1/auth/session")).rejects.toMatchObject({
    status: 503,
    code: "SERVICE_UNAVAILABLE",
  });
});
test.each([
  {},
  { registrationId: "not-a-uuid", expiresAt: "2030-01-01T00:00:00.000Z" },
  {
    registrationId: "d24398d2-409c-4d87-a614-04967b2d705e",
    expiresAt: "not-a-date",
  },
])(
  "malformed registration receipts cannot enter the code screen",
  async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    await expect(
      apiFetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "X-CSRF-Token": "synthetic" },
      }),
    ).rejects.toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
  },
);
test("mutation bootstraps CSRF, carries cookies and never retries a failed login", async () => {
  vi.stubGlobal("window", {});
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: "INVALID_CREDENTIALS" } },
        { status: 401 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    apiFetch("/api/v1/auth/login", { method: "POST", body: "{}" }),
  ).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe(
    "synthetic-csrf",
  );
  expect(fetch.mock.calls[1][1].credentials).toBe("include");
});
test("forbidden paths never receive browser cookies", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    apiFetch("https://example.test/api/v1/auth/session"),
  ).rejects.toThrow("Untrusted API path");
  expect(fetch).not.toHaveBeenCalled();
});
test("server mutation cannot reuse a global browser context", async () => {
  await expect(
    apiFetch("/api/v1/auth/logout", { method: "POST" }),
  ).rejects.toThrow("request-scoped CSRF");
});
test("errors expose only safe fields, Retry-After and code, never raw response detail", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            fields: [
              { path: "email", code: "INVALID_VALUE" },
              { password: "do-not-expose" },
            ],
          },
          password: "do-not-expose",
        },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    ),
  );
  try {
    await apiFetch("/api/v1/auth/session");
    throw Error("Expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      retryAfter: 60,
      fields: [{ path: "email", code: "INVALID_VALUE" }],
    });
    expect(JSON.stringify(error)).not.toContain("do-not-expose");
  }
});
