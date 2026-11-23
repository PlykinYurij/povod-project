import { afterEach, expect, test, vi } from "vitest";
import { publicationSurface } from "./publication-host";

afterEach(() => vi.unstubAllEnvs());

test("routes only one label under the configured invitation domain", () => {
  vi.stubEnv("PUBLIC_INVITATION_BASE_DOMAIN", "invite.example.test");
  vi.stubEnv("PUBLIC_INVITATION_RESERVED_SLUGS", "static");
  expect(publicationSurface("Party.invite.example.test:3000")).toEqual({
    kind: "guest",
    slug: "party",
    hostname: "party.invite.example.test",
  });
  for (const host of [
    "invite.example.test",
    "app.invite.example.test",
    "localhost:3000",
  ]) {
    expect(publicationSurface(host)).toEqual({ kind: "platform" });
  }
  for (const host of [
    "a.b.invite.example.test",
    "invite.example.test.evil.test",
    "evil.test",
    "party.invite.example.test,evil.test",
    "api.invite.example.test",
    "static.invite.example.test",
    "party.invite.example.test:abc",
  ]) {
    expect(publicationSurface(host)).toEqual({ kind: "invalid" });
  }
});
