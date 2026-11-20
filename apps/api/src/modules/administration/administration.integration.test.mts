import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { INestApplication } from "@nestjs/common";
import type { ApiErrorDto } from "../../http/api-error.js";
import { verifyDatabaseTarget } from "../../../../../scripts/database-safety.mjs";
import { changeLocalAdminRole } from "../../../../../scripts/admin-role-change.mjs";
import { csrfHeaders, TEST_ORIGIN } from "../../../tests/auth-client.mjs";

const require = createRequire(import.meta.url);
const {
  createApplication,
  createOpenApiDocument,
}: typeof import("../../create-application.js") = require("../../../dist/create-application.js");
const {
  createDatabaseClient,
}: typeof import("../../database/create-database-client.js") = require("../../../dist/database/create-database-client.js");
const {
  SessionService,
}: typeof import("../identity/session.service.js") = require("../../../dist/modules/identity/session.service.js");
const ids: string[] = [];
const pendingEmails: string[] = [];
let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let url: string;

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  vi.stubEnv("WEB_ORIGIN", TEST_ORIGIN);
  db = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  if (db) {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.pendingRegistration.deleteMany({
      where: { email: { in: pendingEmails } },
    });
    await db.$disconnect();
  }
  vi.unstubAllEnvs();
});

async function account(verified = true) {
  const user = await db.user.create({
    data: {
      email: `admin-test-${randomUUID()}@example.test`,
      // No login in this fixture: SessionService creates a real persisted session.
      passwordHash: "synthetic-unused-password-hash",
      emailVerifiedAt: verified ? new Date() : null,
    },
  });
  ids.push(user.id);
  const token = await db.$transaction((tx) =>
    app.get(SessionService).create(tx, user.id),
  );
  return { ...user, cookie: `povod-session=${token}` };
}

function access(cookie = "", path = "/api/v1/admin/access") {
  return fetch(url + path, { headers: { Cookie: cookie } });
}

function role(userId: string, action: string = "grant") {
  return changeLocalAdminRole({
    connectionString: process.env.POVOD_TEST_DATABASE_URL,
    target: "test",
    marker: "povod_test",
    userId,
    action,
  });
}

test("ordinary accounts default to USER, no admin is auto-created", async () => {
  const user = await account();
  expect(user.role).toBe("USER");
  const rows = await db.$queryRaw<
    { column_default: string }[]
  >`SELECT column_default FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'`;
  expect(rows[0]?.column_default).toContain("USER");
});

test("guest and forged role/header/cookie cannot access operator routes", async () => {
  const guest = await access();
  expect(guest.status).toBe(401);
  expect(((await guest.json()) as ApiErrorDto).error.code).toBe(
    "AUTH_REQUIRED",
  );
  const user = await account();
  const response = await fetch(url + "/api/v1/admin/access?role=ADMIN", {
    headers: {
      Cookie: `${user.cookie}; role=ADMIN`,
      "X-Role": "ADMIN",
      Authorization: "Bearer ADMIN",
    },
  });
  expect(response.status).toBe(403);
  expect(((await response.json()) as ApiErrorDto).error.code).toBe(
    "ADMIN_REQUIRED",
  );
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

test("grant and revoke take effect on the next request with the same session", async () => {
  const user = await account();
  expect((await access(user.cookie)).status).toBe(403);
  expect(await role(user.id)).toMatchObject({
    role: "ADMIN",
    previousRole: "USER",
    changed: true,
  });
  const response = await access(user.cookie);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ role: "ADMIN" });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect(await role(user.id)).toMatchObject({ changed: false });
  expect(await role(user.id, "revoke")).toMatchObject({
    role: "USER",
    changed: true,
  });
  expect((await access(user.cookie)).status).toBe(403);
});

test("granting one owner does not change another owner or expose private projects", async () => {
  const admin = await account();
  const client = await account();
  await role(admin.id);
  expect((await access(admin.cookie)).status).toBe(200);
  expect((await access(client.cookie)).status).toBe(403);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: client.id } })).role,
  ).toBe("USER");
  const created = await fetch(url + "/api/v1/projects", {
    method: "POST",
    headers: {
      ...(await csrfHeaders(url, client.cookie)),
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      templateVersionId: "wedding-garden-v1",
      title: "Private client project",
    }),
  });
  expect(created.status).toBe(201);
  const project = (await created.json()) as { id: string };
  // Operator role does not silently bypass the existing owner API contract.
  expect(
    (await access(admin.cookie, `/api/v1/projects/${project.id}`)).status,
  ).toBe(404);
  expect(
    (await access(client.cookie, `/api/v1/projects/${project.id}`)).status,
  ).toBe(200);
});

test("revoked session remains unauthenticated even for an ADMIN", async () => {
  const user = await account();
  await role(user.id);
  await db.session.updateMany({
    where: { userId: user.id },
    data: { revokedAt: new Date() },
  });
  expect((await access(user.cookie)).status).toBe(401);
});

test("local maintenance rejects unverified, absent users and invalid roles", async () => {
  const user = await account(false);
  await expect(role(user.id)).rejects.toThrow("Confirm the account email");
  await expect(role(randomUUID())).rejects.toThrow("User does not exist");
  await expect(role(user.id, "SUPERADMIN")).rejects.toThrow(
    "Expected grant|revoke",
  );
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role,
  ).toBe("USER");
});

test("role maintenance refuses nonlocal and mismatched test targets before writing", async () => {
  const user = await account();
  await expect(
    changeLocalAdminRole({
      connectionString:
        "postgresql://povod_test:synthetic@remote.example/povod_test",
      target: "test",
      marker: "povod_test",
      userId: user.id,
      action: "grant",
    }),
  ).rejects.toThrow("Refusing database target");
  await expect(
    changeLocalAdminRole({
      connectionString: process.env.POVOD_TEST_DATABASE_URL,
      target: "test",
      marker: "wrong",
      userId: user.id,
      action: "grant",
    }),
  ).rejects.toThrow("Explicit test marker");
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role,
  ).toBe("USER");
});

test("registration rejects attempts to assign administrative fields", async () => {
  const email = `role-registration-${randomUUID()}@example.test`;
  pendingEmails.push(email);
  const response = await fetch(url + "/api/v1/auth/register", {
    method: "POST",
    headers: {
      ...(await csrfHeaders(url)),
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      userName: "Synthetic",
      password: "SyntheticRole1!",
      role: "ADMIN",
      isAdmin: true,
    }),
  });
  expect(response.status).toBe(422);
  const body = (await response.json()) as ApiErrorDto;
  expect(body.error.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "role" }),
      expect.objectContaining({ path: "isAdmin" }),
    ]),
  );
  expect(await db.user.findUnique({ where: { email } })).toBeNull();
  expect(
    await db.pendingRegistration.findUnique({ where: { email } }),
  ).toBeNull();
});

test("no public role mutation route exists", async () => {
  const user = await account();
  const response = await fetch(url + "/api/v1/admin/access", {
    method: "POST",
    headers: { Cookie: user.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "ADMIN" }),
  });
  expect(response.status).toBe(404);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role,
  ).toBe("USER");
});

test("actual local CLI grants/revokes a synthetic account and refuses production", async () => {
  const user = await account();
  const script = fileURLToPath(
    new URL("../../../../../scripts/admin-role.mjs", import.meta.url),
  );
  for (const action of ["grant", "revoke"]) {
    const child = spawnSync(
      process.execPath,
      [script, action, "test", user.id],
      { encoding: "utf8", windowsHide: true, timeout: 15000 },
    );
    expect(child.status, "local maintenance CLI must succeed").toBe(0);
    expect(JSON.parse(child.stdout)).toMatchObject({
      userId: user.id,
      role: action === "grant" ? "ADMIN" : "USER",
    });
  }
  const refused = spawnSync(
    process.execPath,
    [script, "grant", "test", user.id],
    {
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
    },
  );
  expect(refused.status).toBe(1);
  expect(refused.stderr).not.toContain(process.env.POVOD_TEST_DATABASE_URL);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role,
  ).toBe("USER");
});

test("OpenAPI documents cookie auth, response and error boundary", () => {
  const doc = createOpenApiDocument(app);
  const operation = doc.paths["/api/v1/admin/access"]?.get;
  expect(operation?.operationId).toBe("getAdminAccess");
  expect(operation?.security).toEqual([{ session: [] }]);
  expect(Object.keys(operation?.responses ?? {})).toEqual(
    expect.arrayContaining(["200", "401", "403", "503"]),
  );
});
