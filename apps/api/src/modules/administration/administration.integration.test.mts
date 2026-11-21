import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type {
  AdminRequestDetailDto,
  AdminRequestPageDto,
} from "./admin-requests.dto.js";
import type { ProjectDto } from "../projects/project.dto.js";
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
const requestIds: string[] = [];
const assistedProjectIds: string[] = [];
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
    await db.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
    await db.project.deleteMany({ where: { id: { in: assistedProjectIds } } });
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
  expect(doc.paths["/api/v1/admin/requests"]?.get?.security).toEqual([
    { session: [] },
  ]);
  expect(doc.paths["/api/v1/admin/requests/{id}"]?.get?.security).toEqual([
    { session: [] },
  ]);
  const operation = doc.paths["/api/v1/admin/access"]?.get;
  expect(operation?.operationId).toBe("getAdminAccess");
  expect(operation?.security).toEqual([{ session: [] }]);
  expect(Object.keys(operation?.responses ?? {})).toEqual(
    expect.arrayContaining(["200", "401", "403", "503"]),
  );
});

test("operator queue separates contact details, includes the saved draft and blocks non-admins", async () => {
  const owner = await account();
  const operator = await account();
  await role(operator.id);
  await db.user.update({
    where: { id: owner.id },
    data: { userName: "Synthetic owner" },
  });
  const created = await fetch(url + "/api/v1/projects", {
    method: "POST",
    headers: {
      ...(await csrfHeaders(url, owner.cookie)),
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      title: "Synthetic draft",
      templateVersionId: "wedding-garden-v1",
    }),
  });
  expect(created.status).toBe(201);
  const project = (await created.json()) as ProjectDto;
  const id = randomUUID();
  requestIds.push(id);
  const digest = id.replaceAll("-", "").repeat(2);
  await db.serviceRequest.create({
    data: {
      id,
      kind: "PUBLICATION",
      projectId: project.id,
      customerUserId: owner.id,
      contactName: "Private contact",
      phone: "+15550001230",
      contactChannel: "TELEGRAM",
      contactValue: "private-contact-test",
      submittedRevision: project.revision,
      creationKeyHash: digest,
      creationPayloadHash: digest,
      consentVersion: "synthetic",
      consentAt: new Date(),
      createdAt: new Date("2099-12-01T00:00:00Z"),
    },
  });
  const listPath = "/api/v1/admin/requests";
  const detailPath = listPath + "/" + id;
  for (const path of [listPath, detailPath]) {
    expect((await access("", path)).status).toBe(401);
    expect((await access(owner.cookie, path)).status).toBe(403);
  }
  const response = await access(operator.cookie, listPath);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const { items } = (await response.json()) as AdminRequestPageDto;
  expect(items.find((row) => row.id === id)).toEqual({
    id,
    kind: "PUBLICATION",
    status: "NEW",
    templateId: "quiet-garden",
    projectTitle: "Synthetic draft",
    userName: "Synthetic owner",
    hasAccount: true,
    createdAt: "2099-12-01T00:00:00.000Z",
  });
  const detailResponse = await access(operator.cookie, detailPath);
  expect(detailResponse.status).toBe(200);
  expect(detailResponse.headers.get("Cache-Control")).toBe("no-store");
  const detail = (await detailResponse.json()) as AdminRequestDetailDto;
  expect(detail).toMatchObject({
    id,
    phone: "+15550001230",
    contactValue: "private-contact-test",
    submittedRevision: 1,
    quotedPrice: null,
    project,
  });
  expect(detail).not.toHaveProperty("creationKeyHash");
  expect(detail).not.toHaveProperty("customerUserId");
  expect(
    (await access(operator.cookie, detailPath + "?includeAll=true")).status,
  ).toBe(422);
  expect(
    (await access(operator.cookie, listPath + "?after=invalid")).status,
  ).toBe(422);
  expect(
    (await access(operator.cookie, listPath + "?after=" + id + "&after=" + id))
      .status,
  ).toBe(422);
  expect(
    (await access(operator.cookie, listPath + "/" + randomUUID())).status,
  ).toBe(404);
  async function update(
    cookie: string,
    status: string,
    expectedVersion: number,
    csrf = true,
  ) {
    return fetch(url + detailPath + "/status", {
      method: "PATCH",
      headers: {
        ...(csrf ? await csrfHeaders(url, cookie) : { Cookie: cookie }),
        Origin: TEST_ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status, expectedVersion }),
    });
  }
  expect((await update(owner.cookie, "IN_PROGRESS", 1)).status).toBe(403);
  expect((await update(operator.cookie, "IN_PROGRESS", 1, false)).status).toBe(
    403,
  );
  expect((await update(operator.cookie, "COMPLETED", 1)).status).toBe(422);
  const inProgress = await update(operator.cookie, "IN_PROGRESS", 1);
  expect(await inProgress.json()).toEqual({
    id,
    status: "IN_PROGRESS",
    requestVersion: 2,
  });
  expect((await update(operator.cookie, "IN_PROGRESS", 1)).status).toBe(200);
  expect((await update(operator.cookie, "REJECTED", 1)).status).toBe(409);
  const rejected = await update(operator.cookie, "REJECTED", 2);
  expect(await rejected.json()).toEqual({
    id,
    status: "REJECTED",
    requestVersion: 3,
  });
  expect((await update(operator.cookie, "IN_PROGRESS", 3)).status).toBe(409);
  const ownerView = await access(
    owner.cookie,
    "/api/v1/projects/" + project.id + "/publication-request",
  );
  expect(await ownerView.json()).toMatchObject({
    request: null,
    lastClosed: {
      requestId: id,
      status: "REJECTED",
      updatedAt: expect.any(String),
    },
  });
  await role(operator.id, "revoke");
  expect((await access(operator.cookie, detailPath)).status).toBe(403);
  expect((await update(operator.cookie, "IN_PROGRESS", 3)).status).toBe(403);
});

test("operator queue pages without duplicates when creation timestamps tie", async () => {
  const operator = await account();
  await role(operator.id);
  const fixtureIds = Array.from({ length: 31 }, () => randomUUID())
    .sort()
    .reverse();
  requestIds.push(...fixtureIds);
  await db.serviceRequest.createMany({
    data: fixtureIds.map((id) => {
      const digest = id.replaceAll("-", "").repeat(2);
      return {
        id,
        contactName: "Synthetic queue",
        phone: "+15550001230",
        contactChannel: "VK",
        contactValue: "synthetic-page",
        creationKeyHash: digest,
        creationPayloadHash: digest,
        consentVersion: "synthetic",
        consentAt: new Date(),
        createdAt: new Date("2100-01-01T00:00:00Z"),
      };
    }),
  });
  const path = "/api/v1/admin/requests";
  const first = await access(operator.cookie, path);
  expect(first.status).toBe(200);
  const page = (await first.json()) as AdminRequestPageDto;
  expect(page.items.map((row) => row.id)).toEqual(fixtureIds.slice(0, 30));
  expect(page.next).toBe(fixtureIds[29]);
  const second = await access(operator.cookie, path + "?after=" + page.next);
  expect(second.status).toBe(200);
  const next = (await second.json()) as AdminRequestPageDto;
  expect(next.items[0].id).toBe(fixtureIds[30]);
  expect(
    next.items.some((row) => page.items.some((seen) => seen.id === row.id)),
  ).toBe(false);
});

test("an anonymous request creates one operator-managed project and reuses the draft validator", async () => {
  const admin = await account();
  const ordinary = await account();
  await role(admin.id);
  const id = randomUUID();
  requestIds.push(id);
  const digest = id.replaceAll("-", "").repeat(2);
  await db.serviceRequest.create({
    data: {
      id,
      kind: "ASSISTANCE",
      contactName: "Synthetic client",
      phone: "+15550001233",
      contactChannel: "VK",
      contactValue: "synthetic-client",
      creationKeyHash: digest,
      creationPayloadHash: digest,
      consentVersion: "synthetic",
      consentAt: new Date(),
    },
  });
  const path = "/api/v1/admin/requests/" + id + "/project";
  const input = {
    title: "Приглашение клиента",
    templateVersionId: "wedding-garden-v1",
    expectedRequestVersion: 1,
  };
  async function mutate(cookie: string, body: unknown, edit = false) {
    return fetch(url + path + (edit ? "/draft" : ""), {
      method: edit ? "PATCH" : "POST",
      headers: {
        ...(await csrfHeaders(url, cookie)),
        Origin: TEST_ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }
  expect((await mutate(ordinary.cookie, input)).status).toBe(403);
  expect(
    (await mutate(admin.cookie, { ...input, expectedRequestVersion: 2 }))
      .status,
  ).toBe(409);
  expect(
    (await mutate(admin.cookie, { ...input, templateVersionId: "unknown-v1" }))
      .status,
  ).toBe(404);
  expect(
    (await db.serviceRequest.findUniqueOrThrow({ where: { id } })).projectId,
  ).toBeNull();
  const responses = await Promise.all([
    mutate(admin.cookie, input),
    mutate(admin.cookie, input),
  ]);
  const linked = await db.serviceRequest.findUniqueOrThrow({ where: { id } });
  if (linked.projectId) assistedProjectIds.push(linked.projectId);
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  const [project, repeat] = await Promise.all(
    responses.map(async (response) => (await response.json()) as ProjectDto),
  );
  expect(repeat.id).toBe(project.id);
  expect(linked).toMatchObject({
    customerUserId: null,
    projectId: project.id,
    status: "IN_PROGRESS",
    requestVersion: 2,
  });
  expect(
    await db.project.findUniqueOrThrow({ where: { id: project.id } }),
  ).toMatchObject({
    ownerId: null,
    createdByUserId: admin.id,
    revision: 1,
  });
  expect(
    (await mutate(admin.cookie, { ...input, title: "Другой проект" })).status,
  ).toBe(409);
  expect(
    (await access(admin.cookie, "/api/v1/projects/" + project.id)).status,
  ).toBe(404);
  expect(await (await access(admin.cookie, "/api/v1/projects")).json()).toEqual(
    { items: [] },
  );
  const edit = {
    title: "Исправленное название",
    content: project.content,
    expectedRevision: 1,
  };
  expect((await mutate(ordinary.cookie, edit, true)).status).toBe(403);
  const updated = await mutate(admin.cookie, edit, true);
  expect(updated.status).toBe(200);
  expect(await updated.json()).toMatchObject({
    title: edit.title,
    revision: 2,
  });
  expect((await mutate(admin.cookie, edit, true)).status).toBe(409);
  expect(await (await mutate(admin.cookie, input)).json()).toMatchObject({
    id: project.id,
    title: edit.title,
    revision: 2,
  });
});
