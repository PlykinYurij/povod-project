import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { relayGuestRsvp } from "./rsvp-relay.server";

const domain = "invites.example.test";
const host = "party." + domain;
const key = "62654033-a24e-48c1-aec0-26122499f18a";
const secret = "bc".repeat(32);
const upstream = "http://127.0.0.1:4000";

beforeEach(() => {
  vi.stubEnv("PUBLIC_INVITATION_BASE_DOMAIN", domain);
  vi.stubEnv("POVOD_INTERNAL_API_ORIGIN", upstream);
  vi.stubEnv("RSVP_RELAY_SECRET", secret);
  vi.stubEnv("POVOD_RSVP_LOCAL_HTTP", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request(headers: Record<string, string> = {}, body = "{}") {
  return new Request("https://" + host + "/rsvp", {
    method: "POST",
    headers: {
      Host: host,
      Origin: "https://" + host,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      "X-Povod-Rsvp-Client-IP": "192.0.2.1",
      ...headers,
    },
    body,
  });
}

test("requires a guest Host and same origin before contacting the API", async () => {
  const fetchFake = vi.fn();
  vi.stubGlobal("fetch", fetchFake);
  expect(
    (await relayGuestRsvp(request({ Host: "app." + domain }))).status,
  ).toBe(404);
  expect(
    (await relayGuestRsvp(request({ Origin: "https://foreign.example.test" })))
      .status,
  ).toBe(403);
  expect(
    (
      await relayGuestRsvp(
        request({ "X-Povod-Rsvp-Client-IP": "192.0.2.1, 192.0.2.2" }),
      )
    ).status,
  ).toBe(503);
  expect((await relayGuestRsvp(request({}, "x".repeat(4097)))).status).toBe(
    413,
  );
  expect(fetchFake).not.toHaveBeenCalled();
});

test("uses fixed API address, replaces relay proof, strips credentials and preserves Retry-After", async () => {
  const fetchFake = vi.fn().mockResolvedValue(
    Response.json(
      { error: { code: "RATE_LIMITED" } },
      {
        status: 429,
        headers: { "Retry-After": "15", "Set-Cookie": "synthetic" },
      },
    ),
  );
  vi.stubGlobal("fetch", fetchFake);
  const result = await relayGuestRsvp(
    request({
      Cookie: "synthetic",
      Authorization: "synthetic",
      "X-Povod-Rsvp-Relay": "ignored",
    }),
  );
  expect(result.status).toBe(429);
  expect(result.headers.get("Retry-After")).toBe("15");
  expect(result.headers.get("Set-Cookie")).toBeNull();
  const [uri, options] = fetchFake.mock.calls[0];
  expect(String(uri)).toBe(
    upstream + "/api/v1/public/invitations/by-address/party/rsvp",
  );
  expect(Object.fromEntries(options.headers)).toEqual({
    "content-type": "application/json",
    "idempotency-key": key,
    "x-povod-rsvp-client-ip": "192.0.2.1",
    "x-povod-rsvp-relay": secret,
  });
  expect(options).toMatchObject({
    method: "POST",
    redirect: "error",
    cache: "no-store",
  });
});
