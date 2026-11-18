import { beforeAll, beforeEach, afterAll, afterEach, expect, test, vi } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { verifyDatabaseTarget } from "../../../scripts/database-safety.mjs";
import type { INestApplication } from "@nestjs/common";
import type { RegisterResponseDto } from "../src/modules/identity/register.dto.js";
import type { ApiErrorDto } from "../src/http/api-error.js";
import { csrfHeaders } from "./auth-client.mjs";

const json = <T,>(response: Response): Promise<T> =>
  response.json() as Promise<T>;
type Contract = {
  paths: Record<
    string,
    { post: { operationId: string; responses: Record<string, unknown> } }
  >;
  components: {
    schemas: Record<
      string,
      { properties: Record<string, { writeOnly?: boolean }> }
    >;
  };
};

const require = createRequire(import.meta.url);
const {
  createApplication,
  enableOpenApi,
}: typeof import("../src/create-application.js") = require("../dist/create-application.js");
const {
  createDatabaseClient,
}: typeof import("../src/database/create-database-client.js") = require("../dist/database/create-database-client.js");
const {
  verifyPassword,
}: typeof import("../src/modules/identity/password.js") = require("../dist/modules/identity/password.js");
const { AuthClock }: typeof import("../src/modules/identity/auth-clock.js") = require("../dist/modules/identity/auth-clock.js");
const { SessionService }: typeof import("../src/modules/identity/session.service.js") = require("../dist/modules/identity/session.service.js");
const { RegistrationService }: typeof import("../src/modules/identity/registration.service.js") = require("../dist/modules/identity/registration.service.js");
let inbox: string;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const ipKeys = ["127.0.0.1", "::ffff:127.0.0.1"].map(ip => hash(JSON.stringify(["registration-request", "ip", ip])));
let app: INestApplication;
let url: string;
let database: ReturnType<typeof createDatabaseClient>;
const emails: string[] = [];
const password = "Synthetic1!password";
const email = () => {
  const value = `e104-${randomUUID()}+tag@example.test`;
  emails.push(value);
  return value;
};
const request = (
  body: unknown,
  origin: string | undefined = "http://127.0.0.1:3000",
  contentType = "application/json",
) =>
  csrfHeaders(url).then((csrf) =>
    fetch(`${url}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...csrf,
        ...(origin ? { Origin: origin } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  database = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  process.env.REGISTER_RATE_LIMIT = "100"; // fixture; separate test covers throttling
  inbox = await mkdtemp(join(tmpdir(), "povod-signup-test-"));
  process.env.LOCAL_MAIL_DIR = inbox;
  app = await createApplication();
  enableOpenApi(app);
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
});
beforeEach(async () => { await database.resetRateLimit.deleteMany({ where: { key: { in: ipKeys } } }); });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  if (database) {
    await database.user.deleteMany({ where: { email: { in: emails } } });
    await database.pendingRegistration.deleteMany({ where: { email: { in: emails } } });
    await database.resetRateLimit.deleteMany({ where: { key: { in: [...ipKeys, ...emails.map(e => hash(JSON.stringify(["registration-request", "email", e])))] } } });
    await database.$disconnect();
  }
  await app?.close();
  if (inbox?.startsWith(join(tmpdir(), "povod-signup-test-"))) await rm(inbox, { recursive: true, force: true });
  delete process.env.LOCAL_MAIL_DIR;
});


async function mailFor(id: string) {
  const row = await database.pendingRegistration.findUniqueOrThrow({ where: { id } });
  return JSON.parse(await readFile(join(inbox, row.nonce + ".json"), "utf8")) as { code: string };
}
async function action(path: string, payload: unknown) {
  const csrf = await csrfHeaders(url);
  return fetch(url + "/api/v1/auth/register/" + path, { method: "POST", headers: { ...csrf, Origin: "http://127.0.0.1:3000", "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
async function complete(address: string, value = password) {
  const start = await request({ email: address, password: value });
  expect(start.status).toBe(202);
  const { registrationId } = await json<{ registrationId: string }>(start);
  const mail = await mailFor(registrationId);
  return action("confirm", { registrationId, code: mail.code });
}
test("pending has no user or session; confirmation creates safe owner and hashed password", async () => {
  const address = email();
  const start = await request({ email: "  " + address.toUpperCase() + "  ", password });
  expect(start.status).toBe(202);
  expect(start.headers.get("cache-control")).toBe("no-store");
  expect(start.headers.getSetCookie().some(c => c.includes("povod-session="))).toBe(false);
  expect(await database.user.count({ where: { email: address } })).toBe(0);
  const { registrationId } = await json<{ registrationId: string }>(start);
  const mail = await mailFor(registrationId);
  const response = await action("confirm", { registrationId, code: mail.code });
  expect(response.status).toBe(201);
  expect(response.headers.get("set-cookie")).toContain("povod-session=");
  const body = await json<RegisterResponseDto>(response);
  expect(Object.keys(body)).toEqual(["user"]);
  expect(Object.keys(body.user).sort()).toEqual(["email", "id"]);
  expect(body.user.email).toBe(address);
  const current = await fetch(`${url}/api/v1/auth/session`, { headers: { Cookie: response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ") } });
  expect(current.status).toBe(200);
  const stored = await database.user.findUniqueOrThrow({ where: { email: address } });
  expect(await verifyPassword(stored.passwordHash, password)).toBe(true);
  expect(stored.emailVerifiedAt).not.toBeNull();
  expect(await verifyPassword(stored.passwordHash, password + " ")).toBe(false);
  expect((await action("confirm", { registrationId, code: mail.code })).status).toBe(400);
  expect((await request({ email: address, password })).status).toBe(409);
});
test("concurrent normalized starts replace pending; only latest id and credentials can confirm", async () => {
  const address = email();
  const replies = await Promise.all([request({ email: address, password }), request({ email: address.toUpperCase(), password })]);
  expect(replies.map(r => r.status)).toEqual([202, 202]);
  const row = await database.pendingRegistration.findUniqueOrThrow({ where: { email: address } });
  expect(await database.user.count({ where: { email: address } })).toBe(0);
  const mail = await mailFor(row.id);
  const outcomes = await Promise.all([action("confirm", { registrationId: row.id, code: mail.code }), action("confirm", { registrationId: row.id, code: mail.code })]);
  expect(outcomes.map(r => r.status).sort()).toEqual([201, 400]);
  expect(await database.user.count({ where: { email: address } })).toBe(1);
});

test("rejects unknown server fields and invalid email/password without reflecting secrets", async () => {
  const address = email();
  for (const invalid of [
    "Aa1!abc",
    "lowercase1!",
    "UPPERCASE!",
    "Uppercase1",
    "Aa1!".repeat(33),
    "Пароль1!Aa",
    "Aa1!café",
    "Aa1!abcd😀",
    "Аa1!abcd",
    "Aa١!abcd",
    "Aa1!abcd\n",
    "Aa1!abcd\t",
  ]) {
    const response = await request({ email: address, password: invalid });
    expect(response.status).toBe(422);
    const text = await response.text();
    expect(text).not.toContain(invalid);
    expect(JSON.parse(text).error.fields).toContainEqual({
      path: "password",
      code: "INVALID_VALUE",
    });
  }
  for (const invalid of [
    { email: address, password, role: "superadmin" },
    { email: 123, password },
    { email: "invalid", password },
    { email: address, password: null },
  ]) {
    expect((await request(invalid)).status).toBe(422);
  }
  expect(await database.user.count({ where: { email: address } })).toBe(0);
});

test("accepts exactly 8/128 characters and does not trim valid passwords", async () => {
  for (const valid of ["Aa1!abcd", `Aa1!${"x".repeat(124)}`, " Aa1!abcd "]) {
    const address = email();
    expect((await complete(address, valid)).status).toBe(
      201,
    );
    const stored = await database.user.findUniqueOrThrow({
      where: { email: address },
    });
    expect(await verifyPassword(stored.passwordHash, valid)).toBe(true);
  }
});

test("rejects cross-origin, missing origin, unsupported content type and malformed JSON", async () => {
  expect(
    (await request({ email: email(), password }, "https://untrusted.example"))
      .status,
  ).toBe(403);
  expect((await request({ email: email(), password }, "")).status).toBe(403);
  expect((await request("text", undefined, "text/plain")).status).toBe(415);
  const malformed = await request("{broken");
  expect(malformed.status).toBe(400);
  expect((await json<ApiErrorDto>(malformed)).error.code).toBe(
    "MALFORMED_JSON",
  );
  const large = await request(JSON.stringify({ password: "x".repeat(110000) }));
  expect(large.status).toBe(413);
});

test("exports usable OpenAPI registration request/response/errors without private columns", async () => {
  const response = await fetch(`${url}/api/openapi.json`);
  expect(response.status).toBe(200);
  const doc = await json<Contract>(response);
  const route = doc.paths["/api/v1/auth/register"].post;
  expect(route.operationId).toBe("register");
  for (const status of [202, 400, 403, 409, 413, 415, 422, 429, 503])
    expect(route.responses[status]).toBeDefined();
  expect(doc.components.schemas.RegisterDto.properties.password.writeOnly).toBe(
    true,
  );
  expect(
    Object.keys(doc.components.schemas.RegisteredUserDto.properties).sort(),
  ).toEqual(["email", "id"]);
  expect(JSON.stringify(doc)).not.toContain("passwordHash");
  const health = await fetch(`${url}/health`);
  expect(await health.json()).toEqual({ status: "ok" });
});

test("rate limiter counts invalid forms, ignores forged forwarded IP and returns Retry-After", async () => {
  process.env.REGISTER_RATE_LIMIT = "1";
  const limited: INestApplication = await createApplication();
  process.env.REGISTER_RATE_LIMIT = "100";
  try {
    await limited.listen(0, "127.0.0.1");
    const address = `${await limited.getUrl()}/api/v1/auth/register`;
    const options = {
      method: "POST",
      headers: {
        ...(await csrfHeaders(await limited.getUrl())),
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3000",
      },
      body: "{}",
    };
    expect((await fetch(address, options)).status).toBe(422);
    const second = await fetch(address, {
      ...options,
      headers: { ...options.headers, "X-Forwarded-For": "198.51.100.99" },
    });
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await json<ApiErrorDto>(second)).error.code).toBe("RATE_LIMITED");
  } finally {
    await limited.close();
  }
});

test("trusted CORS preflight works and production CSRF stays closed without its secret", async () => {
  const preflight = await fetch(`${url}/api/v1/auth/register`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-origin")).toBe(
    "http://127.0.0.1:3000",
  );
  const old = {
    mode: process.env.NODE_ENV,
    origin: process.env.WEB_ORIGIN,
    limit: process.env.REGISTER_RATE_LIMIT,
  };
  let production: INestApplication | undefined;
  try {
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = "http://127.0.0.1:3000";
    delete process.env.REGISTER_RATE_LIMIT;
    production = await createApplication();
    await production.listen(0, "127.0.0.1");
    const response = await fetch(
      `${await production.getUrl()}/api/v1/auth/csrf`,
      { headers: { Origin: "http://127.0.0.1:3000" } },
    );
    expect(response.status).toBe(503);
  } finally {
    for (const [key, value] of [
      ["NODE_ENV", old.mode],
      ["WEB_ORIGIN", old.origin],
      ["REGISTER_RATE_LIMIT", old.limit],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
    await production?.close();
  }
});

test("missing database produces safe 503 without falsely creating an account", async () => {
  const originalUrl = process.env.DATABASE_URL;
  const address = email();
  let unavailable: INestApplication | undefined;
  try {
    delete process.env.DATABASE_URL;
    unavailable = await createApplication();
    await unavailable.listen(0, "127.0.0.1");
    const response = await fetch(
      `${await unavailable.getUrl()}/api/v1/auth/register`,
      {
        method: "POST",
        headers: {
          ...(await csrfHeaders(await unavailable.getUrl())),
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({ email: address, password }),
      },
    );
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain(password);
    expect(text).not.toContain(address);
    expect(JSON.parse(text).error.code).toBe("SERVICE_UNAVAILABLE");
    expect(await database.user.count({ where: { email: address } })).toBe(0);
  } finally {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    await unavailable?.close();
  }
});

test("five wrong attempts exhaust the code without creating an owner", async () => {
  const address = email();
  const start = await json<{ registrationId: string }>(await request({ email: address, password }));
  const mail = await mailFor(start.registrationId);
  const wrong = mail.code === "000000" ? "000001" : "000000";
  const results = await Promise.all(Array.from({ length: 5 }, () => action("confirm", { registrationId: start.registrationId, code: wrong })));
  expect(results.every(r => r.status === 400)).toBe(true);
  expect((await action("confirm", { registrationId: start.registrationId, code: mail.code })).status).toBe(400);
  expect(await database.user.count({ where: { email: address } })).toBe(0);
});

test("resend cancels old code and does not extend the 24-hour pending lifetime", async () => {
  const address = email();
  const { registrationId } = await json<{ registrationId: string }>(await request({ email: address, password }));
  const first = await mailFor(registrationId);
  const before = await database.pendingRegistration.findUniqueOrThrow({ where: { id: registrationId } });
  expect((await action("resend", { registrationId })).status).toBe(202);
  const latest = await mailFor(registrationId);
  expect((await action("confirm", { registrationId, code: first.code })).status).toBe(400);
  expect((await database.pendingRegistration.findUniqueOrThrow({ where: { id: registrationId } })).deleteAt).toEqual(before.deleteAt);
  expect((await action("confirm", { registrationId, code: latest.code })).status).toBe(201);
});

test("a new start replaces password and id; the previous code cannot authorize new credentials", async () => {
  const address = email();
  const old = await json<{ registrationId: string }>(await request({ email: address, password }));
  const first = await mailFor(old.registrationId);
  const replacement = "Replacement2!password";
  const next = await json<{ registrationId: string }>(await request({ email: address, password: replacement }));
  expect((await action("confirm", { registrationId: old.registrationId, code: first.code })).status).toBe(400);
  const latest = await mailFor(next.registrationId);
  expect((await action("confirm", { registrationId: next.registrationId, code: latest.code })).status).toBe(201);
  const user = await database.user.findUniqueOrThrow({ where: { email: address } });
  expect(await verifyPassword(user.passwordHash, replacement)).toBe(true);
  expect(await verifyPassword(user.passwordHash, password)).toBe(false);
});

test("exact code expiry and pending expiry deny access; cleanup physically removes pending", async () => {
  const now = Date.now();
  vi.spyOn(app.get(AuthClock), "now").mockImplementation(() => new Date(now));
  const address = email();
  const start = await json<{ registrationId: string }>(await request({ email: address, password }));
  const mail = await mailFor(start.registrationId);
  vi.spyOn(app.get(AuthClock), "now").mockImplementation(() => new Date(now + 10 * 60_000));
  expect((await action("confirm", { registrationId: start.registrationId, code: mail.code })).status).toBe(400);
  vi.spyOn(app.get(AuthClock), "now").mockImplementation(() => new Date(now + 24 * 60 * 60_000));
  expect((await action("resend", { registrationId: start.registrationId })).status).toBe(400);
  await app.get(RegistrationService).cleanup();
  expect(await database.pendingRegistration.count({ where: { email: address } })).toBe(0);
});

test("session failure rolls back account creation and code consumption; retry succeeds", async () => {
  const address = email();
  const start = await json<{ registrationId: string }>(await request({ email: address, password }));
  const mail = await mailFor(start.registrationId);
  vi.spyOn(app.get(SessionService), "create").mockRejectedValueOnce(new Error("Synthetic session failure"));
  expect((await action("confirm", { registrationId: start.registrationId, code: mail.code })).status).toBe(503);
  expect(await database.user.count({ where: { email: address } })).toBe(0);
  expect((await action("confirm", { registrationId: start.registrationId, code: mail.code })).status).toBe(201);
});

test("start and resend share email and IP limits", async () => {
  const address = email();
  const start = await json<{ registrationId: string }>(await request({ email: address, password }));
  expect((await action("resend", { registrationId: start.registrationId })).status).toBe(202);
  expect((await action("resend", { registrationId: start.registrationId })).status).toBe(202);
  const fourth = await action("resend", { registrationId: start.registrationId });
  expect(fourth.status).toBe(429);
  expect(Number(fourth.headers.get("retry-after"))).toBeGreaterThan(0);
});

test("delivery failure cannot create an account or usable challenge", async () => {
  const { ResetMailService }: typeof import("../src/modules/identity/reset-mail.service.js") = require("../dist/modules/identity/reset-mail.service.js");
  vi.spyOn(app.get(ResetMailService), "send").mockRejectedValueOnce(new Error("Synthetic mail failure"));
  const address = email();
  expect((await request({ email: address, password })).status).toBe(503);
  const pending = await database.pendingRegistration.findUniqueOrThrow({ where: { email: address } });
  expect(pending.deliveredAt).toBeNull();
  expect(await database.user.count({ where: { email: address } })).toBe(0);
});

test("confirm and resend reject missing CSRF, extra fields and malformed code", async () => {
  const address = email();
  const { registrationId } = await json<{ registrationId: string }>(await request({ email: address, password }));
  for (const path of ["confirm", "resend"]) {
    const response = await fetch(`${url}/api/v1/auth/register/${path}`, { method: "POST", headers: { Origin: "http://127.0.0.1:3000", "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, code: "000000" }) });
    expect(response.status).toBe(403);
  }
  for (const code of [123456, "123456\n", "１２３４５６"]) expect((await action("confirm", { registrationId, code })).status).toBe(422);
  expect((await action("confirm", { registrationId, code: "000000", role: "superadmin" })).status).toBe(422);
  expect((await action("resend", { registrationId: randomUUID() })).status).toBe(400);
});

test("IP mail limit spans different registrations and ignores forged forwarded IP", async () => {
  for (let n = 0; n < 10; n++) expect((await request({ email: email(), password })).status).toBe(202);
  const response = await fetch(`${url}/api/v1/auth/register`, { method: "POST", headers: { ...await csrfHeaders(url), Origin: "http://127.0.0.1:3000", "Content-Type": "application/json", "X-Forwarded-For": "192.0.2.123" }, body: JSON.stringify({ email: email(), password }) });
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
});

test("late obsolete delivery cannot activate an old request", async () => {
  const { ResetMailService }: typeof import("../src/modules/identity/reset-mail.service.js") = require("../dist/modules/identity/reset-mail.service.js");
  const sender = app.get(ResetMailService), original = sender.send.bind(sender);
  let release!: () => void, started!: () => void;
  const waiting = new Promise<void>(r => { release = r; });
  const observed = new Promise<void>(r => { started = r; });
  let oldCode = "";
  vi.spyOn(sender, "send").mockImplementationOnce(async message => { oldCode = message.code; started(); await waiting; await original(message); });
  const address = email(), first = request({ email: address, password });
  await observed;
  let latest!: { registrationId: string };
  try { latest = await json<{ registrationId: string }>(await request({ email: address, password })); }
  finally { release(); }
  const stale = await json<{ registrationId: string }>(await first);
  expect((await action("confirm", { registrationId: stale.registrationId, code: oldCode })).status).toBe(400);
  const mail = await mailFor(latest.registrationId);
  expect((await action("confirm", { registrationId: latest.registrationId, code: mail.code })).status).toBe(201);
});
