import { beforeAll, beforeEach, afterAll, afterEach, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { INestApplication } from "@nestjs/common";
import { verifyDatabaseTarget } from "../../../scripts/database-safety.mjs";
import { csrfHeaders, mergeCookies, TEST_ORIGIN } from "./auth-client.mjs";

const require = createRequire(import.meta.url);
const { createApplication, enableOpenApi }: typeof import("../src/create-application.js") = require("../dist/create-application.js");
const { createDatabaseClient }: typeof import("../src/database/create-database-client.js") = require("../dist/database/create-database-client.js");
const { AuthClock }: typeof import("../src/modules/identity/auth-clock.js") = require("../dist/modules/identity/auth-clock.js");
const { ResetMailService }: typeof import("../src/modules/identity/reset-mail.service.js") = require("../dist/modules/identity/reset-mail.service.js");
const { DatabaseService }: typeof import("../src/database/database.service.js") = require("../dist/database/database.service.js");
const { verifyPassword }: typeof import("../src/modules/identity/password.js") = require("../dist/modules/identity/password.js");
const { hashPassword }: typeof import("../src/modules/identity/password.js") = require("../dist/modules/identity/password.js");
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const oldPassword = "Original1!password";
type ErrorPayload = { error: { code: string } };
type OpenApiContract = {
  components: { schemas: Record<string, { required: string[]; properties: Record<string, { pattern: string }> }> };
  paths: Record<string, { post: { responses: Record<string, unknown> } }>;
};
const newPassword = "Replaced2!password";
const emails: string[] = [];
const emailKeys: string[] = [];
const ipKeys = ["127.0.0.1", "::ffff:127.0.0.1"].map(ip => digest(JSON.stringify(["reset-request", "ip", ip])));
let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let url: string;
let inbox: string;
const previousMail = process.env.LOCAL_MAIL_DIR;

function email() {
  const value = `reset-${randomUUID()}@example.test`;
  emails.push(value);
  emailKeys.push(digest(JSON.stringify(["reset-request", "email", value])));
  return value;
}
class Browser {
  cookies = "";
  async post(path: string, body: unknown) {
    const csrf = await csrfHeaders(url, this.cookies);
    this.cookies = csrf.Cookie;
    const result = await fetch(`${url}/api/v1/auth/${path}`, { method: "POST", headers: { Origin: TEST_ORIGIN, "Content-Type": "application/json", ...csrf }, body: JSON.stringify(body) });
    this.cookies = mergeCookies(this.cookies, result);
    return result;
  }
  current() { return fetch(`${url}/api/v1/auth/session`, { headers: { Cookie: this.cookies } }); }
  request(value: string) { return this.post("password-reset/request", { email: value }); }
  confirm(value: string, code: string, password = newPassword) { return this.post("password-reset/confirm", { email: value, code, newPassword: password }); }
}
async function owner() {
  const value = email();
  const browser = new Browser();
  await db.user.create({ data: { email: value, passwordHash: await hashPassword(oldPassword) } });
  expect((await browser.post("login", { email: value, password: oldPassword })).status).toBe(200);
  return { email: value, browser };
}
async function letters(to: string) {
  const result: { id: string; to: string; code: string; purpose: string }[] = [];
  for (const file of await readdir(inbox)) {
    const item = JSON.parse(await readFile(join(inbox, file), "utf8")) as typeof result[number];
    if (item.to === to) result.push(item);
  }
  return result;
}
async function issue(value: string, browser = new Browser()) {
  const existing = new Set((await letters(value)).map(m => m.id));
  expect((await browser.request(value)).status).toBe(202);
  const message = (await letters(value)).find(m => !existing.has(m.id));
  if (!message) throw new Error("Synthetic mail missing");
  return message;
}
function freeze(now: number) { vi.spyOn(app.get(AuthClock), "now").mockImplementation(() => new Date(now)); }

beforeAll(async () => {
  await verifyDatabaseTarget(process.env.POVOD_TEST_DATABASE_URL, "test", process.env.POVOD_TEST_DATABASE);
  db = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  inbox = await mkdtemp(join(tmpdir(), "povod-reset-test-"));
  process.env.LOCAL_MAIL_DIR = inbox;
  process.env.REGISTER_RATE_LIMIT = "100";
  app = await createApplication();
  enableOpenApi(app);
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
});
beforeEach(async () => { await db.resetRateLimit.deleteMany({ where: { key: { in: ipKeys } } }); });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  if (db) {
    await db.passwordReset.deleteMany({ where: { emailKey: { in: emails.map(digest) } } });
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.resetRateLimit.deleteMany({ where: { key: { in: [...emailKeys, ...ipKeys] } } });
    const loginKeys = emails.flatMap(e => ["127.0.0.1", "::ffff:127.0.0.1"].map(ip => digest(JSON.stringify([e, ip]))));
    await db.loginAttempt.deleteMany({ where: { key: { in: loginKeys } } });
    await db.$disconnect();
  }
  await app?.close();
  if (inbox && inbox.startsWith(join(tmpdir(), "povod-reset-test-"))) await rm(inbox, { recursive: true, force: true });
  if (previousMail === undefined) delete process.env.LOCAL_MAIL_DIR; else process.env.LOCAL_MAIL_DIR = previousMail;
});

test("neutral request, no reset code/token in HTTP or plain code in DB; unknown account gets no mail", async () => {
  const own = await owner();
  const stranger = email();
  const a = await new Browser().request(own.email);
  const b = await new Browser().request(stranger);
  expect(a.status).toBe(202); expect(b.status).toBe(202);
  expect(await a.json()).toEqual(await b.json());
  expect(a.headers.get("cache-control")).toBe("no-store");
  expect(a.headers.getSetCookie().some(c => c.includes("povod-session="))).toBe(false);
  const [mail] = await letters(own.email);
  expect(mail.code.length === 6 && /^[0-9]+$/.test(mail.code)).toBe(true);
  const row = await db.passwordReset.findUniqueOrThrow({ where: { emailKey: digest(own.email) } });
  expect(row.codeHash.length === 64 && row.codeHash !== digest(mail.code)).toBe(true);
  expect(row.deliveredAt !== null).toBe(true);
  expect(await letters(stranger)).toHaveLength(0);
});

test("valid code changes hash, revokes two browsers, no automatic login, replay fails", async () => {
  const own = await owner(); const second = new Browser();
  expect((await second.post("login", { email: own.email, password: oldPassword })).status).toBe(200);
  const mail = await issue(own.email);
  const resetBrowser = new Browser();
  const result = await resetBrowser.confirm(` ${own.email.toUpperCase()} `, mail.code);
  expect(result.status).toBe(204); expect(await result.text()).toBe("");
  expect(result.headers.getSetCookie()).toHaveLength(0);
  expect((await resetBrowser.current()).status).toBe(401);
  expect((await own.browser.current()).status).toBe(401);
  expect((await second.current()).status).toBe(401);
  expect((await resetBrowser.confirm(own.email, mail.code)).status).toBe(400);
  expect((await second.post("login", { email: own.email, password: oldPassword })).status).toBe(401);
  expect((await second.post("login", { email: own.email, password: newPassword })).status).toBe(200);
});

test("wrong code, other email and unknown challenge are neutral; fifth attempt exhausts code", async () => {
  const own = await owner(); const mail = await issue(own.email);
  const browser = new Browser();
  const wrong = mail.code === "000000" ? "000001" : "000000";
  const responses = [await browser.confirm(email(), mail.code)];
  for (let n = 0; n < 5; n++) responses.push(await browser.confirm(own.email, wrong));
  responses.push(await browser.confirm(own.email, mail.code));
  for (const response of responses) { expect(response.status).toBe(400); expect(((await response.json()) as ErrorPayload).error.code).toBe("RESET_CODE_INVALID"); }
  expect((await db.passwordReset.findUniqueOrThrow({ where: { emailKey: digest(own.email) } })).attempts).toBe(5);
  expect((await own.browser.current()).status).toBe(200);
});

test("code expires at the exact ten-minute boundary without cleanup job", async () => {
  const own = await owner(); const now = Date.now(); freeze(now);
  const mail = await issue(own.email);
  freeze(now + 10 * 60_000);
  expect((await new Browser().confirm(own.email, mail.code)).status).toBe(400);
});

test("resend invalidates previous code and starts new lifetime; latest code succeeds", async () => {
  const own = await owner(); const first = await issue(own.email); const last = await issue(own.email);
  const browser = new Browser();
  expect(first.id === last.id).toBe(false);
  expect((await browser.confirm(own.email, first.code)).status).toBe(400);
  expect((await browser.confirm(own.email, last.code)).status).toBe(204);
});

test("parallel confirmations consume once, only the winning password works", async () => {
  const own = await owner(); const mail = await issue(own.email);
  const a = "WinnerA1!password", b = "WinnerB2!password";
  const replies = await Promise.all([new Browser().confirm(own.email, mail.code, a), new Browser().confirm(own.email, mail.code, b)]);
  expect(replies.map(r => r.status).sort()).toEqual([204, 400]);
  const row = await db.user.findUniqueOrThrow({ where: { email: own.email } });
  expect(await verifyPassword(row.passwordHash, replies[0].status === 204 ? a : b)).toBe(true);
});

test("resetting owner A never changes owner B's password or session", async () => {
  const a = await owner(); const b = await owner();
  const mail = await issue(a.email);
  expect((await new Browser().confirm(b.email, mail.code)).status).toBe(400);
  expect((await new Browser().confirm(a.email, mail.code)).status).toBe(204);
  expect((await a.browser.current()).status).toBe(401);
  expect((await b.browser.current()).status).toBe(200);
  const user = await db.user.findUniqueOrThrow({ where: { email: b.email } });
  expect(await verifyPassword(user.passwordHash, oldPassword)).toBe(true);
});

test("concurrent old-password login cannot leave a surviving session after reset", async () => {
  const own = await owner(); const mail = await issue(own.email);
  const signingIn = new Browser();
  const [login, reset] = await Promise.all([
    signingIn.post("login", { email: own.email, password: oldPassword }),
    new Browser().confirm(own.email, mail.code),
  ]);
  expect([200, 401]).toContain(login.status);
  expect(reset.status).toBe(204);
  expect((await signingIn.current()).status).toBe(401);
});

test("five concurrent wrong guesses commit attempts, no lost increments", async () => {
  const own = await owner(); const mail = await issue(own.email);
  const wrong = mail.code === "000000" ? "000001" : "000000";
  const responses = await Promise.all(Array.from({ length: 5 }, () => new Browser().confirm(own.email, wrong)));
  expect(responses.every(r => r.status === 400)).toBe(true);
  expect((await new Browser().confirm(own.email, mail.code)).status).toBe(400);
});

test("email limit counts unknown emails and concurrent requests; resets after one hour", async () => {
  const value = email(); const now = Date.now(); freeze(now);
  const responses = await Promise.all(Array.from({ length: 4 }, () => new Browser().request(value)));
  expect(responses.map(r => r.status).sort()).toEqual([202, 202, 202, 429]);
  expect(Number(responses.find(r => r.status === 429)!.headers.get("retry-after"))).toBe(3600);
  freeze(now + 60 * 60_000);
  expect((await new Browser().request(value)).status).toBe(202);
});

test("IP limit spans different emails and forwarded IP cannot bypass it", async () => {
  for (let n = 0; n < 10; n++) expect((await new Browser().request(email())).status).toBe(202);
  const headers = await csrfHeaders(url);
  const response = await fetch(`${url}/api/v1/auth/password-reset/request`, { method: "POST", headers: { ...headers, Origin: TEST_ORIGIN, "Content-Type": "application/json", "X-Forwarded-For": "192.0.2.1" }, body: JSON.stringify({ email: email() }) });
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("retry-after")) > 0).toBe(true);
});

test("failed mail is neutral but its code is not usable, resend recovers", async () => {
  const own = await owner();
  const spy = vi.spyOn(app.get(ResetMailService), "send").mockRejectedValueOnce(new Error("Synthetic inbox failure"));
  expect((await new Browser().request(own.email)).status).toBe(202);
  const failed = await db.passwordReset.findUniqueOrThrow({ where: { emailKey: digest(own.email) } });
  expect(failed.deliveredAt).toBeNull();
  expect(await letters(own.email)).toHaveLength(0);
  spy.mockRestore(); const next = await issue(own.email);
  expect((await new Browser().confirm(own.email, next.code)).status).toBe(204);
});

test("resend during delivery never reactivates old code", async () => {
  const own = await owner();
  const sender = app.get(ResetMailService); const original = sender.send.bind(sender);
  let release!: () => void; let started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const observed = new Promise<void>(resolve => { started = resolve; });
  let held: { code: string } | undefined;
  vi.spyOn(sender, "send").mockImplementationOnce(async message => { held = message; started(); await waiting; await original(message); });
  const first = new Browser().request(own.email);
  await observed;
  const last = await issue(own.email);
  release(); expect((await first).status).toBe(202);
  if (!held) throw new Error("Missing synthetic delivery");
  expect((await new Browser().confirm(own.email, held.code)).status).toBe(400);
  expect((await new Browser().confirm(own.email, last.code)).status).toBe(204);
});

test("DTO rejects unknown fields, non-ASCII password and malformed code; CSRF required", async () => {
  const value = email(); const browser = new Browser();
  for (const body of [
    { email: value, code: 123456, newPassword },
    { email: value, code: "123456\n", newPassword },
    { email: value, code: "123456", newPassword: "Пароль1!A" },
    { email: value, code: "123456", newPassword, userId: randomUUID() },
  ]) expect((await browser.post("password-reset/confirm", body)).status).toBe(422);
  const denied = await fetch(`${url}/api/v1/auth/password-reset/request`, { method: "POST", headers: { Origin: TEST_ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: value }) });
  expect(denied.status).toBe(403);
});

test("DB failure is sanitized and never reports a successful reset", async () => {
  const own = await owner(); const mail = await issue(own.email);
  vi.spyOn(app.get(DatabaseService), "getClient").mockImplementation(() => { throw new Error("Synthetic database failure"); });
  const response = await new Browser().confirm(own.email, mail.code);
  expect(response.status).toBe(503);
  expect(((await response.json()) as ErrorPayload).error.code).toBe("SERVICE_UNAVAILABLE");
});

test("failure after session revocation rolls back password, session and code consumption together", async () => {
  const own = await owner(); const mail = await issue(own.email);
  const before = await db.user.findUniqueOrThrow({ where: { email: own.email } });
  const client = app.get(DatabaseService).getClient();
  const faulted = client.$extends({ query: { session: {
    async updateMany({ args, query }) {
      await query(args);
      throw new Error("Synthetic failure after revoke");
    },
  } } });
  // Extended client forwards real PostgreSQL transactions; only this test's operation fails.
  const spy = vi.spyOn(app.get(DatabaseService), "getClient").mockReturnValue(faulted as unknown as typeof client);
  expect((await new Browser().confirm(own.email, mail.code)).status).toBe(503);
  spy.mockRestore();
  expect((await db.user.findUniqueOrThrow({ where: { email: own.email } })).passwordHash === before.passwordHash).toBe(true);
  expect((await db.passwordReset.findUniqueOrThrow({ where: { emailKey: digest(own.email) } })).usedAt).toBeNull();
  expect((await own.browser.current()).status).toBe(200);
  expect((await new Browser().confirm(own.email, mail.code)).status).toBe(204);
});

test("production rejects local file transport even if explicitly configured", async () => {
  const before = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    await expect(app.get(ResetMailService).ready()).rejects.toThrow("Восстановление временно недоступно");
  } finally { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; }
});

test("live OpenAPI includes reset fields, shared password rules and error responses", async () => {
  const response = await fetch(`${url}/api/openapi.json`);
  const document = (await response.json()) as OpenApiContract;
  const schema = document.components.schemas.ConfirmPasswordResetDto;
  expect(schema.required.sort()).toEqual(["code", "email", "newPassword"]);
  expect(schema.properties.newPassword.pattern).toBe(document.components.schemas.RegisterDto.properties.password.pattern);
  expect(document.paths["/api/v1/auth/password-reset/request"].post.responses[429]).toBeDefined();
  expect(document.paths["/api/v1/auth/password-reset/confirm"].post.responses[204]).toBeDefined();
});
