import { afterEach, expect, test, vi } from "vitest";
import { createServiceRequest } from "./generated/http";
import { apiFetch } from "./transport";

afterEach(() => vi.unstubAllGlobals());
const input = {
  contactName: "Synthetic",
  phone: "+15550000001",
  contactChannel: "TELEGRAM" as const,
  contactValue: "@synthetic",
  privacyConsent: true as const,
};
const receipt = {
  requestId: "ca32ff69-f61f-401c-8f0f-abd8bd617a5a",
  status: "RECEIVED",
  createdAt: "2026-11-21T00:00:00.000Z",
};
const key = "cedcdb05-38c0-4dc2-b65f-bb1b4e04c050";

test("generated public submission omits credentials and never bootstraps CSRF", async () => {
  vi.stubGlobal("window", {});
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json(receipt, { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    createServiceRequest(input, {
      headers: {
        "Idempotency-Key": key,
        Cookie: "synthetic",
        Authorization: "Bearer synthetic",
        "X-CSRF-Token": "synthetic",
      },
    }),
  ).resolves.toEqual(receipt);
  expect(fetch).toHaveBeenCalledTimes(1);
  const options = fetch.mock.calls[0][1];
  expect(options.credentials).toBe("omit");
  expect(options.cache).toBe("no-store");
  expect(options.headers.get("Idempotency-Key")).toBe(key);
  for (const name of ["Cookie", "Authorization", "X-CSRF-Token"])
    expect(options.headers.has(name)).toBe(false);
  expect(JSON.parse(options.body)).toEqual(input);
});

test("retry key stays caller-owned and 429 does not trigger hidden retries", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { error: { code: "RATE_LIMITED" } },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    createServiceRequest(input, { headers: { "Idempotency-Key": key } }),
  ).rejects.toMatchObject({
    status: 429,
    code: "RATE_LIMITED",
    retryAfter: 60,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("public route allowlist grants neither GET access nor request detail paths", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(apiFetch("/api/v1/service-requests")).rejects.toThrow(
    "only supports POST",
  );
  for (const path of [
    "/api/v1/service-requests?customerUserId=private",
    `/api/v1/service-requests/${receipt.requestId}`,
  ]) {
    await expect(apiFetch(path, { method: "POST" })).rejects.toThrow(
      "Untrusted API path",
    );
  }
  expect(fetch).not.toHaveBeenCalled();
});

test.each([
  { ...receipt, status: "PUBLISHED" },
  { ...receipt, contactName: "private" },
  { ...receipt, createdAt: "invalid" },
  { ...receipt, requestId: "invalid" },
])(
  "malformed or private receipt cannot become a successful submission",
  async (value) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(value)));
    await expect(
      createServiceRequest(input, { headers: { "Idempotency-Key": key } }),
    ).rejects.toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
  },
);
