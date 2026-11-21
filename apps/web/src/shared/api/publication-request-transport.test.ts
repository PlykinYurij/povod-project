import { afterEach, expect, test, vi } from "vitest";
import {
  createPublicationRequest,
  getProjectPublicationRequest,
} from "./generated/http";
import { apiFetch } from "./transport";

afterEach(() => vi.unstubAllGlobals());
const id = "b996c498-c0da-4e3a-8adb-5714074b2d32";
const key = "5573a464-d279-4825-88df-6ca15e5e23ac";
const input = {
  projectId: id,
  expectedRevision: 1,
  expectedPriceVersion: null,
  contactName: "Synthetic",
  phone: "+15550000001",
  contactChannel: "TELEGRAM" as const,
  contactValue: "@synthetic",
  privacyConsent: true as const,
};
const receipt = {
  requestId: "4679b435-0ac1-4e08-a0d9-c09b52d26059",
  status: "RECEIVED",
  createdAt: "2026-11-21T00:00:00.000Z",
};
const active = {
  currentPrice: { amountMinor: 20000, currency: "RUB", version: 2 },
  request: {
    requestId: receipt.requestId,
    kind: "PUBLICATION",
    status: "NEW",
    requestVersion: 1,
    submittedRevision: 1,
    currentProjectRevision: 2,
    price: { amountMinor: 10000, currency: "RUB", version: 1 },
    createdAt: receipt.createdAt,
  },
};

test("private browser mutation bootstraps CSRF and keeps the caller's nonce", async () => {
  vi.stubGlobal("window", {});
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
    .mockResolvedValueOnce(Response.json(receipt, { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    createPublicationRequest(input, { headers: { "Idempotency-Key": key } }),
  ).resolves.toEqual(receipt);
  expect(fetch).toHaveBeenCalledTimes(2);
  const options = fetch.mock.calls[1][1];
  expect(options.credentials).toBe("include");
  expect(options.cache).toBe("no-store");
  expect(options.headers.get("Idempotency-Key")).toBe(key);
  expect(options.headers.get("X-CSRF-Token")).toBe("synthetic-csrf");
  expect(JSON.parse(options.body)).toEqual(input);
});

test("server mutation cannot borrow an implicit CSRF/session context", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    createPublicationRequest(input, { headers: { "Idempotency-Key": key } }),
  ).rejects.toThrow("request-scoped");
  expect(fetch).not.toHaveBeenCalled();
});

test("status GET preserves private cookies and validates distinct current/request prices", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(active));
  vi.stubGlobal("fetch", fetch);
  await expect(
    getProjectPublicationRequest(id, {
      headers: { Cookie: "synthetic-owner" },
    }),
  ).resolves.toEqual(active);
  expect(fetch.mock.calls[0][1].credentials).toBe("include");
  expect(fetch.mock.calls[0][1].cache).toBe("no-store");
  expect(fetch.mock.calls[0][1].headers.get("Cookie")).toBe("synthetic-owner");
});

test("null active request is a valid state rather than a malformed response", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(Response.json({ currentPrice: null, request: null })),
  );
  await expect(getProjectPublicationRequest(id)).resolves.toEqual({
    currentPrice: null,
    request: null,
  });
});

test.each([
  { ...active, email: "private" },
  { ...active, currentPrice: "free" },
  { ...active, request: { ...active.request, status: { toString: "NEW" } } },
  { ...active, request: { ...active.request, submittedRevision: null } },
])("malformed state never becomes a valid owner status", async (value) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(value)));
  await expect(getProjectPublicationRequest(id)).rejects.toMatchObject({
    status: 503,
    code: "SERVICE_UNAVAILABLE",
  });
});

test("new private paths do not enable detail mutation or query injection", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    apiFetch(`/api/v1/projects/${id}/publication-request`, { method: "POST" }),
  ).rejects.toThrow("Unsupported project method");
  await expect(apiFetch("/api/v1/publication-requests")).rejects.toThrow(
    "only supports POST",
  );
  await expect(
    apiFetch("/api/v1/publication-requests?ownerId=forged", { method: "POST" }),
  ).rejects.toThrow("Untrusted API path");
  expect(fetch).not.toHaveBeenCalled();
});
