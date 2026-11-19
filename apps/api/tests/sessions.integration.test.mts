import { beforeAll, afterAll, afterEach, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { verifyDatabaseTarget } from "../../../scripts/database-safety.mjs";
import { csrfHeaders, mergeCookies, TEST_ORIGIN } from "./auth-client.mjs";

const require = createRequire(import.meta.url);
const {
  LoginAttemptsService,
}: typeof import("../src/modules/identity/login-attempts.service.js") = require("../dist/modules/identity/login-attempts.service.js");
const {
  createApplication,
  enableOpenApi,
}: typeof import("../src/create-application.js") = require("../dist/create-application.js");
const {
  createDatabaseClient,
}: typeof import("../src/database/create-database-client.js") = require("../dist/database/create-database-client.js");
const {
  AuthClock,
}: typeof import("../src/modules/identity/auth-clock.js") = require("../dist/modules/identity/auth-clock.js");
const {
  SessionService,
}: typeof import("../src/modules/identity/session.service.js") = require("../dist/modules/identity/session.service.js");
const { hashPassword }: typeof import("../src/modules/identity/password.js") = require("../dist/modules/identity/password.js");
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const password = "Synthetic1!password";
const day = 86400000;
let app: INestApplication;
let url: string;
let db: ReturnType<typeof createDatabaseClient>;
const emails: string[] = [];
const newEmail = () => {
  const email = `sessions-${randomUUID()}@example.test`;
  emails.push(email);
  return email;
};

class Browser {
  cookies = "";
  constructor(readonly base = url) {}
  async post(
    path: string,
    body: unknown,
    extraHeaders: Record<string, string> = {},
  ) {
    const csrf = await csrfHeaders(this.base, this.cookies);
    this.cookies = csrf.Cookie;
    const response = await fetch(`${this.base}/api/v1/auth/${path}`, {
      method: "POST",
      headers: {
        Origin: TEST_ORIGIN,
        "Content-Type": "application/json",
        ...csrf,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    this.cookies = mergeCookies(this.cookies, response);
    return response;
  }
  current(query = "") {
    return fetch(`${this.base}/api/v1/auth/session${query}`, {
      headers: { Cookie: this.cookies },
    });
  }
  token() {
    const value = /(?:^|; )povod-session=([a-f0-9]{64})/.exec(
      this.cookies,
    )?.[1];
    if (!value) throw new Error("Missing session fixture");
    return value;
  }
}
async function owner() {
  const email = newEmail();
  const browser = new Browser();
  await db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
  const response = await browser.post("login", { email, password });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    user: { id: string; email: string };
  };
  return { browser, email, user: body.user, response };
}

test("existing unnamed owners can log in with an existing password containing spaces", async () => {
  const email = newEmail(), legacyPassword = " Synthetic1!password ";
  await db.user.create({ data: { email, passwordHash: await hashPassword(legacyPassword) } });
  const browser = new Browser();
  const response = await browser.post("login", {email,password:legacyPassword});
  expect(response.status).toBe(200);
  expect((await response.json() as {user:{userName:string|null}}).user.userName).toBeNull();
});
function freeze(now: number) {
  vi.spyOn(app.get(AuthClock), "now").mockImplementation(() => new Date(now));
}

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  db = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  process.env.REGISTER_RATE_LIMIT = "100";
  app = await createApplication();
  enableOpenApi(app);
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  if (db) {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    const keys = emails.flatMap((email) =>
      ["127.0.0.1", "::ffff:127.0.0.1"].map((ip) =>
        hash(JSON.stringify([email, ip])),
      ),
    );
    await db.loginAttempt.deleteMany({ where: { key: { in: keys } } });
    await db.$disconnect();
  }
  await app?.close();
});

test("login exposes only user DTO and stores only token hash", async () => {
  const { browser, user, response } = await owner();
  const cookie = response.headers
    .getSetCookie()
    .find((c) => c.startsWith("povod-session="))!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).toContain("Path=/");
  expect(cookie).toContain("Max-Age=2592000");
  expect(cookie).not.toContain("Domain=");
  const session = await db.session.findUniqueOrThrow({
    where: { tokenHash: hash(browser.token()) },
  });
  expect(session.tokenHash).not.toBe(browser.token());
  expect(session.userId).toBe(user.id);
  expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(
    30 * day,
  );
  const current = await browser.current();
  expect(current.status).toBe(200);
  expect(current.headers.get("cache-control")).toBe("no-store");
  expect(await current.json()).toEqual({ user });
});

test("two owners stay isolated and switching account rotates/revokes the old browser session", async () => {
  const malformed = new Browser();
  malformed.cookies = "povod-session=garbage";
  expect((await malformed.current()).status).toBe(401);
  const a = await owner(),
    b = await owner();
  const old = new Browser();
  old.cookies = a.browser.cookies;
  expect(
    await (await a.browser.current(`?ownerId=${b.user.id}`)).json(),
  ).toEqual({ user: a.user });
  expect(await (await b.browser.current()).json()).toEqual({ user: b.user });
  const oldToken = a.browser.token();
  expect(
    (await a.browser.post("login", { email: b.email.toUpperCase(), password }))
      .status,
  ).toBe(200);
  expect(a.browser.token()).not.toBe(oldToken);
  expect((await old.current()).status).toBe(401);
  expect(await (await a.browser.current()).json()).toEqual({ user: b.user });
  expect((await b.browser.current()).status).toBe(200);
});

test("unknown account and wrong password have the same neutral 401", async () => {
  const known = await owner();
  const anonymous = new Browser();
  const wrong = await anonymous.post("login", {
    email: known.email,
    password: "Wrong1!password",
  });
  const missing = await anonymous.post("login", {
    email: newEmail(),
    password: "Wrong1!password",
  });
  expect(wrong.status).toBe(401);
  expect(missing.status).toBe(401);
  const first = (await wrong.json()) as {
    error: { code: string; message: string };
  };
  const second = (await missing.json()) as typeof first;
  expect(first.error.code).toBe("INVALID_CREDENTIALS");
  expect(first.error.message).toBe(second.error.message);
  expect(wrong.headers.get("set-cookie")).toBeNull();
  expect(missing.headers.get("set-cookie")).toBeNull();
});

test("logout is replayable with valid CSRF and revoked cookie cannot authenticate", async () => {
  const { browser } = await owner();
  const headers = await csrfHeaders(url, browser.cookies);
  const options = {
    method: "POST",
    headers: {
      ...headers,
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
    },
    body: "{}",
  };
  const first = await fetch(`${url}/api/v1/auth/logout`, options);
  expect(first.status).toBe(204);
  expect(first.headers.get("set-cookie")).toContain("Max-Age=0");
  expect((await fetch(`${url}/api/v1/auth/logout`, options)).status).toBe(204);
  expect((await browser.current()).status).toBe(401);
  const anonymous = new Browser();
  expect((await anonymous.post("logout", {})).status).toBe(204);
});

test("idle expiry is exact, while valid activity refreshes idle but never extends absolute expiry", async () => {
  const start = Date.now();
  freeze(start);
  const idle = await owner();
  const active = await owner();
  const expires = (
    await db.session.findUniqueOrThrow({
      where: { tokenHash: hash(active.browser.token()) },
    })
  ).expiresAt;
  freeze(start + 6 * day);
  expect((await active.browser.current()).status).toBe(200);
  freeze(start + 7 * day);
  expect((await idle.browser.current()).status).toBe(401);
  expect((await idle.browser.post("logout", {})).status).toBe(204);
  expect((await active.browser.current()).status).toBe(200);
  await db.session.update({
    where: { tokenHash: hash(active.browser.token()) },
    data: { lastSeenAt: new Date(start + 29 * day) },
  });
  freeze(start + 30 * day);
  expect((await active.browser.current()).status).toBe(401);
  expect(
    (
      await db.session.findUniqueOrThrow({
        where: { tokenHash: hash(active.browser.token()) },
      })
    ).expiresAt,
  ).toEqual(expires);
});

test("five concurrent wrong logins are counted atomically, forged IP does not bypass and expiry releases the pair", async () => {
  const start = Date.now();
  freeze(start);
  const account = await owner();
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      new Browser().post("login", {
        email: account.email,
        password: "Wrong1!password",
      }),
    ),
  );
  expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
  const blocked = await new Browser().post(
    "login",
    { email: account.email, password },
    { "X-Forwarded-For": "198.51.100.99" },
  );
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("retry-after")).toBe("900");
  const otherPair = await new Browser().post("login", {
    email: newEmail(),
    password,
  });
  expect(otherPair.status).toBe(401);
  freeze(start + 15 * 60 * 1000);
  expect(
    (await new Browser().post("login", { email: account.email, password }))
      .status,
  ).toBe(200);
});

test("successful login clears previous failures for the pair", async () => {
  const account = await owner();
  const browser = new Browser();
  for (let i = 0; i < 4; i++)
    expect(
      (
        await browser.post("login", {
          email: account.email,
          password: "Wrong1!password",
        })
      ).status,
    ).toBe(401);
  expect(
    (await browser.post("login", { email: account.email, password })).status,
  ).toBe(200);
  for (let i = 0; i < 5; i++)
    expect(
      (
        await browser.post("login", {
          email: account.email,
          password: "Wrong1!password",
        })
      ).status,
    ).toBe(401);
  expect(
    (await browser.post("login", { email: account.email, password })).status,
  ).toBe(429);
});

test("missing, tampered, expired and different-browser CSRF are rejected; session rotation invalidates old CSRF", async () => {
  const email = newEmail();
  await db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
  const body = JSON.stringify({ email, password });
  const plain = { Origin: TEST_ORIGIN, "Content-Type": "application/json" };
  expect(
    (
      await fetch(`${url}/api/v1/auth/register`, {
        method: "POST",
        headers: plain,
        body,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(`${url}/api/v1/auth/login`, {
        method: "POST",
        headers: plain,
        body,
      })
    ).status,
  ).toBe(403);
  const a = await csrfHeaders(url),
    b = await csrfHeaders(url);
  const post = (headers: Record<string, string>) =>
    fetch(`${url}/api/v1/auth/login`, {
      method: "POST",
      headers: { ...plain, ...headers },
      body,
    });
  expect((await post({ ...a, "X-CSRF-Token": b["X-CSRF-Token"] })).status).toBe(
    403,
  );
  expect(
    (
      await post({
        ...a,
        "X-CSRF-Token":
          a["X-CSRF-Token"].slice(0, -1) +
          (a["X-CSRF-Token"].endsWith("0") ? "1" : "0"),
      })
    ).status,
  ).toBe(403);
  const start = Date.now();
  freeze(start);
  const expired = await csrfHeaders(url);
  freeze(start + 3600000);
  expect((await post(expired)).status).toBe(403);
  vi.restoreAllMocks();
  const browser = new Browser();
  const preAuth = await csrfHeaders(url);
  browser.cookies = preAuth.Cookie;
  const registration = await post(preAuth);
  expect(registration.status).toBe(200);
  browser.cookies = mergeCookies(browser.cookies, registration);
  const stale = await fetch(`${url}/api/v1/auth/logout`, {
    method: "POST",
    headers: { ...plain, ...preAuth, Cookie: browser.cookies },
    body: "{}",
  });
  expect(stale.status).toBe(403);
  expect((await browser.post("logout", {})).status).toBe(204);
});

test("OpenAPI describes session/csrf operations, cookie and csrf header and uses credentialed CORS", async () => {
  const csrfResponse = await fetch(`${url}/api/v1/auth/csrf`, { headers: { Origin: TEST_ORIGIN } });
  expect(csrfResponse.headers.get("access-control-expose-headers")).toContain("Retry-After");
  const doc = (await fetch(`${url}/api/openapi.json`).then((r) =>
    r.json(),
  )) as {
    paths: Record<
      string,
      Record<string, { operationId: string; parameters?: { name: string }[] }>
    >;
    components: { securitySchemes: unknown };
  };
  expect(doc.paths["/api/v1/auth/login"].post.operationId).toBe("login");
  expect(doc.paths["/api/v1/auth/session"].get.operationId).toBe("getSession");
  expect(
    doc.paths["/api/v1/auth/logout"].post.parameters?.some(
      (p) => p.name === "X-CSRF-Token",
    ),
  ).toBe(true);
  expect(doc.components.securitySchemes).toBeDefined();
  const cors = await fetch(`${url}/api/v1/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: TEST_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-csrf-token",
    },
  });
  expect(cors.status).toBe(204);
  expect(cors.headers.get("access-control-allow-credentials")).toBe("true");
  expect(
    cors.headers.get("access-control-allow-headers")?.toLowerCase(),
  ).toContain("x-csrf-token");
});

test("login counter survives another API instance and infrastructure failure is not a bad credential", async () => {
  const releaseKey = hash(JSON.stringify([newEmail(), "127.0.0.1"]));
  const expiresAt = new Date(Date.now() + 900000);
  await db.loginAttempt.create({
    data: { key: releaseKey, count: 2, expiresAt },
  });
  await Promise.all([
    app.get(LoginAttemptsService).release(releaseKey, expiresAt),
    app.get(LoginAttemptsService).release(releaseKey, expiresAt),
  ]);
  expect(
    await db.loginAttempt.findUnique({ where: { key: releaseKey } }),
  ).toBeNull();
  const account = await owner();
  const service = app.get(SessionService);
  vi.spyOn(service, "create").mockRejectedValueOnce(
    new Error("Controlled infrastructure failure"),
  );
  expect(
    (await new Browser().post("login", { email: account.email, password }))
      .status,
  ).toBe(503);
  const key = hash(JSON.stringify([account.email, "127.0.0.1"]));
  expect(await db.loginAttempt.findUnique({ where: { key } })).toBeNull();
  for (let i = 0; i < 5; i++)
    expect(
      (
        await new Browser().post("login", {
          email: account.email,
          password: "Wrong1!password",
        })
      ).status,
    ).toBe(401);
  const another = await createApplication();
  try {
    await another.listen(0, "127.0.0.1");
    expect(
      (
        await new Browser(await another.getUrl()).post("login", {
          email: account.email,
          password,
        })
      ).status,
    ).toBe(429);
  } finally {
    await another.close();
  }
});

test("production cookies use Secure host prefixes and the approved registration limit is five", async () => {
  const previous = {
    mode: process.env.NODE_ENV,
    origin: process.env.WEB_ORIGIN,
    secret: process.env.CSRF_SECRET,
    limit: process.env.REGISTER_RATE_LIMIT,
  };
  let production: INestApplication | undefined;
  try {
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = TEST_ORIGIN;
    process.env.CSRF_SECRET = "a".repeat(64);
    process.env.REGISTER_RATE_LIMIT = "100"; // must not override production policy
    production = await createApplication();
    await production.listen(0, "127.0.0.1");
    const browser = new Browser(await production.getUrl());
    const email = newEmail();
    await db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
    const response = await browser.post("login", { email, password });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith("__Host-povod-session="))!;
    const attributes = cookie.replace(/^[^;]+/, "[redacted]");
    expect(attributes).toContain("Secure");
    expect(attributes).toContain("HttpOnly");
    expect(attributes).toContain("Path=/");
    expect(attributes).not.toContain("Domain=");
    for (let i = 0; i < 5; i++)
      expect((await browser.post("register", {})).status).toBe(422);
    expect((await browser.post("register", {})).status).toBe(429);
  } finally {
    await production?.close();
    for (const [key, value] of [
      ["NODE_ENV", previous.mode],
      ["WEB_ORIGIN", previous.origin],
      ["CSRF_SECRET", previous.secret],
      ["REGISTER_RATE_LIMIT", previous.limit],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});
