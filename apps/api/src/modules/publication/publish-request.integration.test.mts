import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { INestApplication } from "@nestjs/common";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { verifyDatabaseTarget } from "../../../../../scripts/database-safety.mjs";
import { csrfHeaders, TEST_ORIGIN } from "../../../tests/auth-client.mjs";
import type { ApiErrorDto } from "../../http/api-error.js";
import type { RsvpDashboardDto } from "../rsvp/rsvp-dashboard.dto.js";
import type {
  PublicationReceiptDto,
  PublishRequestDto,
} from "./publish-request.dto.js";

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
const {
  GardenTemplateService,
}: typeof import("../templates/garden/garden-template.service.js") = require("../../../dist/modules/templates/garden/garden-template.service.js");

const DOMAIN = "invitations.example.test";
const { PublicationExpiryService }: typeof import("./publication-expiry.service.js") =
  require("../../../dist/modules/publication/publication-expiry.service.js");
const { DatabaseService }: typeof import("../../database/database.service.js") =
  require("../../../dist/database/database.service.js");
const DAY = 24 * 60 * 60_000;
const requestIds: string[] = [];
const projectIds: string[] = [];
const userIds: string[] = [];
let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let origin: string;
let admin: Record<string, string>;
let secondAdmin: Record<string, string>;

beforeAll(async () => {
  const url = process.env.POVOD_TEST_DATABASE_URL!;
  await verifyDatabaseTarget(url, "test", process.env.POVOD_TEST_DATABASE);
  vi.stubEnv("WEB_ORIGIN", TEST_ORIGIN);
  vi.stubEnv("PUBLIC_INVITATION_BASE_DOMAIN", DOMAIN);
  vi.stubEnv("PUBLIC_INVITATION_RESERVED_SLUGS", "privacy,static");
  vi.stubEnv("RSVP_RATE_SECRET", "ab".repeat(32));
  db = createDatabaseClient(url);
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
  admin = (await user("ADMIN")).headers;
  secondAdmin = (await user("ADMIN")).headers;
});

afterAll(async () => {
  await app?.close();
  if (db) {
    try {
      const publications = await db.publication.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true },
      });
      const publicationId = { in: publications.map(({ id }) => id) };
      await db.rsvpResponse.deleteMany({ where: { publicationId } });
      await db.publicationReceipt.deleteMany({
        where: { requestId: { in: requestIds } },
      });
      await db.publicationSnapshot.deleteMany({ where: { publicationId } });
      await db.publication.deleteMany({ where: { id: publicationId } });
      await db.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
      await db.projectPhoto.deleteMany({
        where: { projectId: { in: projectIds } },
      });
      await db.project.deleteMany({ where: { id: { in: projectIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await db.$disconnect();
    }
  }
  vi.unstubAllEnvs();
});

async function user(role: "USER" | "ADMIN" = "USER") {
  const record = await db.user.create({
    data: {
      email: `publish-${randomUUID()}@example.test`,
      passwordHash: "synthetic-unused",
      role,
    },
  });
  userIds.push(record.id);
  const token = await db.$transaction((tx) =>
    app.get(SessionService).create(tx, record.id),
  );
  return {
    id: record.id,
    headers: await csrfHeaders(origin, `povod-session=${token}`),
  };
}

async function fixture(
  ownerId: string | null,
  price = true,
  withProject = true,
) {
  const draft = new GardenTemplateService().createDraft(
    "wedding-garden-v1",
    "Синтетический проект",
  );
  const content = {
    ...draft.content,
    names: { first: "Анна", second: "Илья" },
    event: {
      localDate: "2024-02-29",
      localTime: "16:00",
      timeZone: "Europe/Samara",
    },
    venue: { name: "Сад", address: "Самара", routeUrl: null },
  };
  const project = withProject
    ? await db.project.create({
        data: {
          ownerId,
          title: draft.title,
          templateVersionId: draft.templateVersionId,
          content: JSON.parse(JSON.stringify(content)),
          creationKeyHash: randomUUID(),
          creationPayloadHash: randomUUID(),
        },
      })
    : null;
  if (project) projectIds.push(project.id);
  const request = await db.serviceRequest.create({
    data: {
      projectId: project?.id,
      submittedRevision: project?.revision,
      status: "IN_PROGRESS",
      kind: ownerId ? "PUBLICATION" : "ASSISTANCE",
      customerUserId: ownerId,
      contactName: "Тестовый заказчик",
      phone: "+70000000123",
      contactChannel: "TELEGRAM",
      contactValue: "synthetic-contact",
      creationKeyHash: randomUUID(),
      creationPayloadHash: randomUUID(),
      priceSnapshotMinor: price ? 120_000 : null,
      priceSnapshotVersion: price ? 19 : null,
      priceSnapshotCurrency: price ? "RUB" : null,
      consentVersion: "test",
      consentAt: new Date(),
    },
  });
  requestIds.push(request.id);
  const input: PublishRequestDto = {
    expectedRequestVersion: request.requestVersion,
    expectedProjectRevision: project?.revision ?? 1,
    expectedPriceVersion: 19,
    slug: `wedding-${randomUUID()}`,
  };
  return { request, project, input, content };
}

function publish(
  requestId: string,
  body: unknown,
  headers = admin,
  key: string = randomUUID(),
) {
  return fetch(`${origin}/api/v1/admin/requests/${requestId}/publish`, {
    method: "POST",
    headers: {
      ...headers,
      Origin: TEST_ORIGIN,
      "Idempotency-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const payload = (await response.json()) as ApiErrorDto;
  expect(payload.error.code).toBe(code);
  return payload.error;
}

test("expiry tombstones only expired running projects and skips locked projects", async () => {
  const owner = await user();
  const expired = await fixture(owner.id);
  const paused = await fixture(null);
  const active = await fixture(null);
  const due = (await (await publish(expired.request.id, expired.input)).json()) as PublicationReceiptDto;
  const frozen = (await (await publish(paused.request.id, paused.input)).json()) as PublicationReceiptDto;
  expect((await publish(active.request.id, active.input)).status).toBe(201);
  await db.publication.update({
    where: { id: due.publicationId },
    data: { expiresAt: new Date(0) },
  });
  await db.publication.update({
    where: { id: frozen.publicationId },
    data: { expiresAt: new Date(1_000), pausedAt: new Date(0), visible: false },
  });

  const database = new DatabaseService();
  vi.spyOn(database, "getClient").mockReturnValue(db);
  const expiry = new PublicationExpiryService(database);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${expired.project!.id}::uuid FOR UPDATE`;
    await expiry.runOnce();
    expect((await tx.project.findUniqueOrThrow({ where: { id: expired.project!.id } })).deletedAt).toBeNull();
  });

  await expiry.runOnce();
  const deleted = await db.project.findUniqueOrThrow({ where: { id: expired.project!.id } });
  expect(deleted.deletedAt).not.toBeNull();
  expect(await db.publicationSnapshot.findUnique({ where: { id: due.snapshotId } })).not.toBeNull();
  await expectError(await fetch(`${origin}/api/v1/projects/${deleted.id}`, { headers: owner.headers }), 404, "PROJECT_NOT_FOUND");
  await expiry.runOnce();
  expect((await db.project.findUniqueOrThrow({ where: { id: deleted.id } })).deletedAt).toEqual(deleted.deletedAt);
  for (const surviving of [paused, active]) {
    expect((await db.project.findUniqueOrThrow({ where: { id: surviving.project!.id } })).deletedAt).toBeNull();
  }
});

async function expectDraft(projectId: string, requestId: string) {
  expect(await db.publication.findUnique({ where: { projectId } })).toBeNull();
  expect(
    await db.publicationReceipt.findUnique({ where: { requestId } }),
  ).toBeNull();
  expect(
    (await db.project.findUniqueOrThrow({ where: { id: projectId } }))
      .firstPublishedAt,
  ).toBeNull();
  expect(
    (await db.serviceRequest.findUniqueOrThrow({ where: { id: requestId } }))
      .status,
  ).toBe("IN_PROGRESS");
}

test.each(["PAUSE_PERIOD", "KEEP_RUNNING"] as const)(
  "removes a publication with %s, unlocks its draft and preserves the published data",
  async (mode) => {
    const owner = await user();
    const { project, request, input, content } = await fixture(owner.id);
    const initial = await publish(request.id, input);
    expect(initial.status).toBe(201);
    const published = (await initial.json()) as PublicationReceiptDto;
    const previousSnapshot = await db.publicationSnapshot.findUniqueOrThrow({
      where: { id: published.snapshotId },
    });
    const path = `${origin}/api/v1/public/invitations/by-address/${input.slug}`;
    const submit = () =>
      fetch(`${path}/rsvp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          formVersionId: published.snapshotId,
          name: "Гость",
          attendance: "yes",
          companions: 0,
        }),
      });
    expect((await submit()).status).toBe(201);

    const reviewerInput = {
      expectedProjectRevision: 1,
      expectedPublicationVersion: 1,
      mode,
      reason: "Исправление данных по заявке",
    };
    const action = (
      body = reviewerInput,
      key: string = randomUUID(),
      headers = admin,
    ) =>
      fetch(`${origin}/api/v1/admin/projects/${project!.id}/unpublish`, {
        method: "POST",
        headers: {
          ...headers,
          Origin: TEST_ORIGIN,
          "Idempotency-Key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    await expectError(
      await action(reviewerInput, randomUUID(), {}),
      401,
      "AUTH_REQUIRED",
    );
    await expectError(await action(reviewerInput, randomUUID(), owner.headers), 403, "ADMIN_REQUIRED");
    await expectError(
      await action({ ...reviewerInput, expectedProjectRevision: 2 }),
      409,
      "REVISION_CONFLICT",
    );
    await expectError(
      await action({ ...reviewerInput, expectedPublicationVersion: 2 }),
      409,
      "PUBLICATION_STATE_CONFLICT",
    );
    const key = randomUUID();
    const result = await action({ ...reviewerInput, reason: `  ${reviewerInput.reason}  ` }, key);
    expect(result.status).toBe(200);
    const receipt = await result.json();
    const paused = mode === "PAUSE_PERIOD";
    expect(receipt).toEqual({
      publicationId: published.publicationId,
      publicationVersion: 2,
      status: paused ? "PAUSED" : "UNPUBLISHED",
      expiresAt: paused ? null : published.expiresAt,
      remainingMs: paused ? expect.any(Number) : null,
    });
    const replay = await action(reviewerInput, key.toUpperCase());
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(receipt);
    await expectError(
      await action({ ...reviewerInput, reason: "Другая причина" }, key),
      409,
      "IDEMPOTENCY_KEY_REUSED",
    );
    expect((await fetch(path)).status).toBe(404);
    expect((await submit()).status).toBe(404);
    expect(await db.publicationSnapshot.findUniqueOrThrow({ where: { id: published.snapshotId } }))
      .toEqual(previousSnapshot);
    expect(await db.rsvpResponse.count({ where: { publicationId: published.publicationId } })).toBe(1);
    expect(await db.publicationUnpublishReceipt.findMany({ where: { publicationId: published.publicationId } }))
      .toMatchObject([{ mode, reason: reviewerInput.reason, actorId: expect.any(String) }]);
    const detail = await fetch(`${origin}/api/v1/admin/requests/${request.id}`, { headers: admin });
    expect(await detail.json()).toMatchObject({ publicationLifecycle: receipt, publication: published });
    const readProject = async () =>
      (await fetch(`${origin}/api/v1/projects/${project!.id}`, { headers: owner.headers })).json();
    expect(await readProject()).toMatchObject({ canEditDraft: true, firstPublishedAt: published.publishedAt });
    const save = (expectedRevision: number) =>
      fetch(`${origin}/api/v1/projects/${project!.id}/draft`, {
        method: "PATCH",
        headers: { ...owner.headers, Origin: TEST_ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision, title: "Исправленный проект", content }),
      });
    const saveDraft = await save(1);
    expect(saveDraft.status).toBe(200);
    expect(await saveDraft.json()).toMatchObject({ revision: 2, canEditDraft: true });

    // Move the stored deadline into the past. Only the paused mode preserves access.
    await db.publication.update({
      where: { id: published.publicationId },
      data: { expiresAt: new Date(2_000), pausedAt: paused ? new Date(1_000) : null },
    });
    expect(await readProject()).toMatchObject({ canEditDraft: paused });
    if (!paused) {
      await expectError(await save(2), 409, "CONTENT_LOCKED");
      expect(await readProject()).toMatchObject({ revision: 2 });
    }
    const dashboard = await fetch(`${origin}/api/v1/projects/${project!.id}/responses`, { headers: owner.headers });
    expect(dashboard.status).toBe(paused ? 200 : 404);
  },
);

test("serializes duplicate removal and unlocks the administrator's assisted editor", async () => {
  const { project, request, input, content } = await fixture(null);
  expect((await publish(request.id, input)).status).toBe(201);
  const path = `${origin}/api/v1/admin/projects/${project!.id}/unpublish`;
  const editorPath = `${origin}/api/v1/admin/requests/${request.id}/project/draft`;
  const gate = (name: string) =>
    fetch(editorPath, {
      method: "PATCH",
      headers: { ...admin, Origin: TEST_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: 1, title: name, content }),
    });
  await expectError(await gate("Помощь с заказом"), 409, "CONTENT_LOCKED");
  const key = randomUUID();
  const run = (reason: string) =>
    fetch(path, {
      method: "POST",
      headers: {
        ...admin,
        Origin: TEST_ORIGIN,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        expectedProjectRevision: 1,
        expectedPublicationVersion: 1,
        mode: "PAUSE_PERIOD",
        reason,
      }),
    });
  const [first, second] = await Promise.all([run("Обновление"), run("Обновление")]);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(await second.json()).toEqual(await first.json());
  const saved = await gate("Помощь с заказом");
  expect(saved.status).toBe(200);
  expect(await saved.json()).toMatchObject({ revision: 2, canEditDraft: true });
});

test("serves RSVP dashboard only to the owner and to administrators of assisted projects", async () => {
  const { paths } = createOpenApiDocument(app);
  for (const route of [
    "/api/v1/projects/{id}/responses",
    "/api/v1/admin/requests/{id}/responses",
  ]) {
    expect(paths[route].get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/RsvpDashboardDto" },
        },
      },
    });
  }
  const owner = await user();
  const other = await user();
  const a = await fixture(owner.id);
  const b = await fixture(null);
  const draft = await fixture(owner.id);
  const requestPath = (id: string) =>
    `${origin}/api/v1/admin/requests/${id}/responses`;
  const projectPath = (id: string) =>
    `${origin}/api/v1/projects/${id}/responses`;
  const ownerPath = projectPath(a.project!.id);
  const assistedPath = requestPath(b.request.id);
  await expectError(
    await fetch(ownerPath, { headers: owner.headers }),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
  expect((await publish(a.request.id, a.input)).status).toBe(201);
  const published = await publish(b.request.id, b.input);
  expect(published.status).toBe(201);
  const receipt = (await published.json()) as PublicationReceiptDto;
  const empty = {
    counts: { total: 0, yes: 0, no: 0, companions: 0 },
    items: [],
  };
  const emptyResponse = await fetch(ownerPath, { headers: owner.headers });
  expect(emptyResponse.headers.get("cache-control")).toBe("private, no-store");
  expect(await emptyResponse.json()).toEqual(empty);
  expect(await (await fetch(assistedPath, { headers: admin })).json()).toEqual(
    empty,
  );
  await expectError(await fetch(ownerPath), 401, "AUTH_REQUIRED");
  await expectError(
    await fetch(ownerPath, { headers: other.headers }),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
  await expectError(
    await fetch(ownerPath, { headers: admin }),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
  await expectError(
    await fetch(assistedPath, { headers: owner.headers }),
    403,
    "ADMIN_REQUIRED",
  );
  await expectError(
    await fetch(requestPath(a.request.id), { headers: admin }),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
  await expectError(
    await fetch(projectPath(draft.project!.id), { headers: owner.headers }),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
  const revoked = await user("ADMIN");
  await db.user.update({ where: { id: revoked.id }, data: { role: "USER" } });
  await expectError(
    await fetch(assistedPath, { headers: revoked.headers }),
    403,
    "ADMIN_REQUIRED",
  );
  for (const query of [
    "attendance=maybe",
    "attendance=yes&attendance=no",
    "ownerId=foreign",
  ]) {
    await expectError(
      await fetch(assistedPath + "?" + query, { headers: admin }),
      422,
      "VALIDATION_FAILED",
    );
  }
  const guestPath = `${origin}/api/v1/public/invitations/by-address/${b.input.slug}/rsvp`;
  for (const [attendance, companions] of [
    ["yes", 2],
    ["no", 0],
    ["yes", 1],
  ]) {
    const result = await fetch(guestPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        formVersionId: receipt.snapshotId,
        name: "Синтетический гость",
        attendance,
        companions,
      }),
    });
    expect(result.status).toBe(201);
  }
  const tie = new Date("2026-11-23T08:00:00Z");
  await db.rsvpResponse.updateMany({
    where: { publicationId: receipt.publicationId },
    data: { createdAt: tie },
  });
  await db.publication.update({
    where: { id: receipt.publicationId },
    data: { visible: false },
  });
  const result = await fetch(assistedPath + "?attendance=yes", {
    headers: admin,
  });
  expect(result.status).toBe(200);
  const body = (await result.json()) as RsvpDashboardDto;
  expect(body.counts).toEqual({ total: 3, yes: 2, no: 1, companions: 3 });
  expect(body.items).toHaveLength(2);
  expect(body.items.map(({ id }) => id)).toEqual(
    body.items
      .map(({ id }) => id)
      .sort()
      .reverse(),
  );
  for (const row of body.items) {
    expect(row).toEqual({
      id: expect.any(String),
      name: "Синтетический гость",
      attendance: "yes",
      companions: expect.any(Number),
      receivedAt: tie.toISOString(),
    });
  }
  expect(
    await (await fetch(ownerPath, { headers: owner.headers })).json(),
  ).toEqual(empty);
  await db.publication.update({
    where: { id: receipt.publicationId },
    data: { expiresAt: new Date(0) },
  });
  await expectError(
    await fetch(assistedPath, { headers: admin }),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
});

test("exports a formula-safe workbook, removes a reply and releases its slot without replaying it", async () => {
  const owner = await user();
  const other = await user();
  const fixtureA = await fixture(owner.id);
  const fixtureB = await fixture(null);
  const a = (await (
    await publish(fixtureA.request.id, fixtureA.input)
  ).json()) as PublicationReceiptDto;
  const b = (await (
    await publish(fixtureB.request.id, fixtureB.input)
  ).json()) as PublicationReceiptDto;
  const path = `${origin}/api/v1/projects/${fixtureA.project!.id}/responses`;
  const assisted = `${origin}/api/v1/admin/requests/${fixtureB.request.id}/responses`;
  const mime =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const guestKey = randomUUID();
  const payload = {
    formVersionId: a.snapshotId,
    name: '=Гость("<&>")',
    attendance: "yes",
    companions: 2,
  };
  const guest = (key: string, body = payload) =>
    fetch(
      `${origin}/api/v1/public/invitations/by-address/${fixtureA.input.slug}/rsvp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    );
  const submit = await guest(guestKey);
  expect(submit.status).toBe(201);
  const { responseId } = (await submit.json()) as { responseId: string };
  const second = await db.rsvpResponse.create({
    data: {
      publicationId: b.publicationId,
      formVersionId: b.snapshotId,
      name: "Другой гость",
      attendance: "no",
      companions: 0,
      keyHash: "a".repeat(64),
    },
  });

  const exported = await fetch(path + "/export", { headers: owner.headers });
  expect(exported.status).toBe(200);
  expect(exported.headers.get("Content-Type")).toBe(mime);
  expect(exported.headers.get("Content-Disposition")).toBe(
    'attachment; filename="rsvp-responses.xlsx"',
  );
  expect(exported.headers.get("Cache-Control")).toBe("private, no-store");
  const zip = unzipSync(new Uint8Array(await exported.arrayBuffer()));
  const sheet = strFromU8(zip["xl/worksheets/sheet1.xml"]);
  expect(sheet).toContain("Имя или псевдоним");
  expect(sheet).toContain(
    't="inlineStr"><is><t xml:space="preserve">=Гость("&lt;&amp;&gt;")',
  );
  expect(sheet).toContain('<c r="C2"><v>2</v></c>');
  expect(sheet).not.toContain("<f>");
  expect(sheet).not.toContain("Другой гость");
  expect((await fetch(assisted + "/export", { headers: admin })).status).toBe(
    200,
  );
  await expectError(
    await fetch(path + "/export", { headers: other.headers }),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
  await expectError(
    await fetch(assisted + "/export", { headers: owner.headers }),
    403,
    "ADMIN_REQUIRED",
  );

  const remove = (url: string, headers: Record<string, string>, body = {}) =>
    fetch(url, {
      method: "DELETE",
      headers: {
        ...headers,
        Origin: TEST_ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  await expectError(
    await remove(path + "/" + responseId, { Cookie: owner.headers.Cookie }),
    403,
    "CSRF_FAILED",
  );
  await expectError(
    await remove(path + "/" + responseId, other.headers),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
  await expectError(
    await remove(path + "/" + second.id, owner.headers),
    404,
    "RSVP_RESPONSE_NOT_FOUND",
  );
  await expectError(
    await remove(path + "/" + responseId, owner.headers, {
      responseId: second.id,
    }),
    422,
    "VALIDATION_FAILED",
  );
  await db.rsvpResponse.createMany({
    data: Array.from({ length: 299 }, (_, index) => ({
      publicationId: a.publicationId,
      formVersionId: a.snapshotId,
      keyHash: (index + 1).toString(16).padStart(64, "0"),
      name: "Синтетический гость",
      attendance: "no" as const,
      companions: 0,
    })),
  });
  await expectError(await guest(randomUUID()), 409, "RSVP_LIMIT_REACHED");
  const removals = await Promise.all([
    remove(path + "/" + responseId, owner.headers),
    remove(path + "/" + responseId, owner.headers),
  ]);
  expect(removals.map(({ status }) => status)).toEqual([204, 204]);
  await expectError(await guest(guestKey), 409, "RSVP_RESPONSE_DELETED");
  await expectError(
    await guest(guestKey, { ...payload, name: "Новое значение" }),
    409,
    "RSVP_RESPONSE_DELETED",
  );
  expect(
    await db.rsvpResponse.findUnique({ where: { id: responseId } }),
  ).toBeNull();
  expect(
    await db.rsvpDeletedKey.count({
      where: { responseId, publicationId: a.publicationId },
    }),
  ).toBe(1);
  expect((await guest(randomUUID())).status).toBe(201);
  expect(
    await db.rsvpResponse.count({ where: { publicationId: a.publicationId } }),
  ).toBe(300);
  expect((await remove(assisted + "/" + second.id, admin)).status).toBe(204);
  expect(
    await db.rsvpResponse.count({ where: { publicationId: b.publicationId } }),
  ).toBe(0);
  await db.publication.update({
    where: { id: b.publicationId },
    data: { expiresAt: new Date(0) },
  });
  await expectError(
    await fetch(assisted + "/export", { headers: admin }),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
  await expectError(
    await remove(assisted + "/" + second.id, admin),
    404,
    "RSVP_DASHBOARD_UNAVAILABLE",
  );
});

test("requires fresh admin role, CSRF and trusted origin", async () => {
  const owner = await user();
  const { project, request, input } = await fixture(owner.id);
  await expectError(await publish(request.id, input, {}), 401, "AUTH_REQUIRED");
  await expectError(
    await publish(request.id, input, owner.headers),
    403,
    "ADMIN_REQUIRED",
  );
  await expectError(
    await publish(request.id, input, { Cookie: admin.Cookie }),
    403,
    "CSRF_FAILED",
  );
  const revoked = await user("ADMIN");
  await db.user.update({ where: { id: revoked.id }, data: { role: "USER" } });
  await expectError(
    await publish(request.id, input, revoked.headers),
    403,
    "ADMIN_REQUIRED",
  );
  await expectDraft(project!.id, request.id);
});

test("commits the reviewed snapshot, stable URL, period, audit and RSVP together", async () => {
  const owner = await user();
  const { project, request, input, content } = await fixture(owner.id);
  // The operator previews a newer save than the revision recorded at intake.
  await db.project.update({
    where: { id: project!.id },
    data: { revision: 2 },
  });
  await expectError(await publish(request.id, input), 409, "REVISION_CONFLICT");
  const reviewed = { ...input, expectedProjectRevision: 2 };
  const key = randomUUID();
  const result = await publish(request.id, reviewed, admin, key);
  expect(result.status).toBe(201);
  expect(result.headers.get("cache-control")).toBe("no-store");
  const receipt = (await result.json()) as PublicationReceiptDto;
  expect(receipt).toEqual({
    publicationId: expect.any(String),
    snapshotId: expect.any(String),
    url: `https://${input.slug}.${DOMAIN}/`,
    requestVersion: request.requestVersion + 1,
    publishedAt: expect.any(String),
    expiresAt: expect.any(String),
  });
  expect(Date.parse(receipt.expiresAt) - Date.parse(receipt.publishedAt)).toBe(
    90 * DAY,
  );
  expect(
    await db.publicationReceipt.findUniqueOrThrow({
      where: { requestId: request.id },
    }),
  ).toMatchObject({
    publicationId: receipt.publicationId,
    actorId: expect.any(String),
    snapshotId: receipt.snapshotId,
  });
  expect(
    await db.serviceRequest.findUniqueOrThrow({ where: { id: request.id } }),
  ).toMatchObject({
    status: "COMPLETED",
    submittedRevision: 1,
    requestVersion: receipt.requestVersion,
    priceSnapshotMinor: 120_000,
  });
  const snapshot = await db.publicationSnapshot.findUniqueOrThrow({
    where: { id: receipt.snapshotId },
  });
  expect(snapshot).toMatchObject({
    projectRevision: 2,
    content,
    formSchema: "garden_v1",
  });
  const saved = await fetch(`${origin}/api/v1/projects/${project!.id}/draft`, {
    method: "PATCH",
    headers: {
      ...owner.headers,
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Новое название",
      expectedRevision: 2,
      content,
    }),
  });
  await expectError(saved, 409, "CONTENT_LOCKED");
  const detail = await fetch(`${origin}/api/v1/admin/requests/${request.id}`, {
    headers: admin,
  });
  expect(detail.status).toBe(200);
  expect(await detail.json()).toMatchObject({ publication: receipt });
  const pagePath = `${origin}/api/v1/public/invitations/by-address/${input.slug}`;
  // The guest gets the published content even if the draft data is changed in storage.
  await db.project.update({
    where: { id: project!.id },
    data: { content: {} },
  });
  const publicSnapshot = await fetch(pagePath);
  expect(publicSnapshot.status).toBe(200);
  expect(publicSnapshot.headers.get("Cache-Control")).toBe("no-store");
  expect(publicSnapshot.headers.get("Set-Cookie")).toBeNull();
  expect(await publicSnapshot.json()).toEqual({
    templateVersionId: "wedding-garden-v1",
    snapshotId: receipt.snapshotId,
    content,
    cover: null,
    rsvp: {
      formVersionId: receipt.snapshotId,
      schema: "garden-v1",
      nameMaxLength: 80,
      maxCompanions: 2,
    },
  });
  const guestPath = pagePath + "/rsvp";
  const form = await fetch(guestPath);
  expect(form.status).toBe(200);
  expect(await form.json()).toMatchObject({
    formVersionId: receipt.snapshotId,
    schema: "garden-v1",
  });
  const rsvp = await fetch(guestPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      formVersionId: receipt.snapshotId,
      name: "Гость",
      attendance: "no",
      companions: 0,
    }),
  });
  expect(rsvp.status).toBe(201);
  const replay = await publish(request.id, reviewed, admin, key.toUpperCase());
  expect(replay.status).toBe(200);
  expect(await replay.json()).toEqual(receipt);
  await expectError(
    await publish(
      request.id,
      { ...reviewed, slug: "different-address" },
      admin,
      key,
    ),
    409,
    "IDEMPOTENCY_KEY_REUSED",
  );
  await expectError(
    await publish(request.id, reviewed, secondAdmin),
    409,
    "ALREADY_PUBLISHED",
  );
  await db.publication.update({
    where: { id: receipt.publicationId },
    data: { visible: false },
  });
  await expectError(await fetch(pagePath), 404, "INVITATION_UNAVAILABLE");
  await db.publication.update({
    where: { id: receipt.publicationId },
    data: { visible: true, expiresAt: new Date(0) },
  });
  await expectError(await fetch(pagePath), 404, "INVITATION_UNAVAILABLE");
});

test("keeps a draft when request, quote, content, address or configuration is invalid", async () => {
  const { project, request, input } = await fixture(null, false);
  await expectError(
    await publish(randomUUID(), input),
    404,
    "REQUEST_NOT_FOUND",
  );
  const unlinked = await fixture(null, false, false);
  await expectError(
    await publish(unlinked.request.id, unlinked.input),
    409,
    "REQUEST_PROJECT_REQUIRED",
  );
  await expectError(
    await publish(request.id, { ...input, expectedRequestVersion: 2 }),
    409,
    "REQUEST_STATE_CONFLICT",
  );
  await expectError(
    await publish(request.id, input),
    409,
    "PRICE_NOT_CONFIGURED",
  );
  await db.serviceRequest.update({
    where: { id: request.id },
    data: {
      priceSnapshotMinor: 120_000,
      priceSnapshotVersion: 19,
      priceSnapshotCurrency: "RUB",
    },
  });
  await expectError(
    await publish(request.id, { ...input, expectedPriceVersion: 18 }),
    409,
    "PRICE_CHANGED",
  );
  for (const slug of [
    "ab",
    "dom.example",
    "UpperCase",
    "-start",
    "end-",
    "address\n",
    "admin",
    "privacy",
  ]) {
    const details = await expectError(
      await publish(request.id, { ...input, slug }),
      422,
      "VALIDATION_FAILED",
    );
    expect(details.fields).toContainEqual(
      expect.objectContaining({ path: "slug" }),
    );
  }
  await expectError(
    await publish(request.id, { ...input, ownerId: randomUUID() }),
    422,
    "VALIDATION_FAILED",
  );
  vi.stubEnv("PUBLIC_INVITATION_BASE_DOMAIN", "https://invalid.example.test");
  try {
    await expectError(
      await publish(request.id, input),
      503,
      "SERVICE_UNAVAILABLE",
    );
  } finally {
    vi.stubEnv("PUBLIC_INVITATION_BASE_DOMAIN", DOMAIN);
  }
  await db.project.update({
    where: { id: project!.id },
    data: { content: {} },
  });
  await expectError(await publish(request.id, input), 422, "VALIDATION_FAILED");
  await expectDraft(project!.id, request.id);
});

test("rejects processing or foreign photos and publishes an owned ready rendition", async () => {
  const { project, request, input, content } = await fixture(null);
  const other = await fixture(null);
  const photo = await db.projectPhoto.create({
    data: {
      projectId: other.project!.id,
      status: "READY",
      mime: "image/png",
      width: 10,
      height: 10,
      byteSize: 10,
      uploadKeyHash: randomUUID(),
      sha256: "a".repeat(64),
      renditionToken: randomUUID(),
      renderWidth: 10,
      renderHeight: 10,
    },
  });
  await db.project.update({
    where: { id: project!.id },
    data: {
      content: JSON.parse(
        JSON.stringify({ ...content, heroMediaId: photo.id }),
      ),
    },
  });
  const invalid = await expectError(
    await publish(request.id, input),
    422,
    "VALIDATION_FAILED",
  );
  expect(invalid.fields).toEqual([
    { path: "content.heroMediaId", code: "MEDIA_NOT_FOUND" },
  ]);
  await db.projectPhoto.update({
    where: { id: photo.id },
    data: {
      projectId: project!.id,
      status: "PROCESSING",
      renditionToken: null,
      renderWidth: null,
      renderHeight: null,
    },
  });
  await expectError(await publish(request.id, input), 422, "VALIDATION_FAILED");
  await expectDraft(project!.id, request.id);
  await db.projectPhoto.update({
    where: { id: photo.id },
    data: {
      status: "READY",
      renditionToken: randomUUID(),
      renderWidth: 10,
      renderHeight: 10,
    },
  });
  const published = await publish(request.id, input);
  expect(published.status).toBe(201);
  const receipt = (await published.json()) as PublicationReceiptDto;
  const pagePath = `${origin}/api/v1/public/invitations/by-address/${input.slug}`;
  expect(await (await fetch(pagePath)).json()).toEqual({
    templateVersionId: "wedding-garden-v1",
    snapshotId: receipt.snapshotId,
    content: { ...content, heroMediaId: receipt.snapshotId },
    cover: { width: 10, height: 10 },
    rsvp: {
      formVersionId: receipt.snapshotId,
      schema: "garden-v1",
      nameMaxLength: 80,
      maxCompanions: 2,
    },
  });
  await expectError(
    await fetch(pagePath + "/cover/" + photo.id),
    404,
    "INVITATION_UNAVAILABLE",
  );
});

test("serializes two operators on one request and two projects on one address", async () => {
  const a = await fixture(null);
  const b = await fixture(null);
  const inputs = { ...b.input, slug: a.input.slug };
  const results = await Promise.all([
    publish(a.request.id, a.input, admin),
    publish(b.request.id, inputs, secondAdmin),
  ]);
  expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
  const losing = results[0].status === 409 ? a : b;
  await expectError(
    results.find(({ status }) => status === 409)!,
    409,
    "SLUG_TAKEN",
  );
  await expectDraft(losing.project!.id, losing.request.id);
  const repeated = await Promise.all([
    publish(losing.request.id, { ...losing.input, slug: b.input.slug }, admin),
    publish(
      losing.request.id,
      { ...losing.input, slug: `other-${randomUUID()}` },
      secondAdmin,
    ),
  ]);
  expect(repeated.map(({ status }) => status).sort()).toEqual([201, 409]);
  await expectError(
    repeated.find(({ status }) => status === 409)!,
    409,
    "ALREADY_PUBLISHED",
  );
  expect(
    await db.publication.count({ where: { projectId: losing.project!.id } }),
  ).toBe(1);
});

test("counts hidden publications for the owner, serializes the last slot and releases expired slots", async () => {
  const owner = await user();
  const [a, b, c] = await Promise.all([
    fixture(owner.id),
    fixture(owner.id),
    fixture(owner.id),
  ]);
  expect((await publish(a.request.id, a.input)).status).toBe(201);
  await db.publication.update({
    where: { projectId: a.project!.id },
    data: { visible: false },
  });
  const results = await Promise.all([
    publish(b.request.id, b.input, admin),
    publish(c.request.id, c.input, secondAdmin),
  ]);
  expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
  await expectError(
    results.find(({ status }) => status === 409)!,
    409,
    "PUBLICATION_LIMIT_REACHED",
  );
  const failed = results[0].status === 409 ? b : c;
  await expectDraft(failed.project!.id, failed.request.id);
  await db.publication.update({
    where: { projectId: a.project!.id },
    data: { expiresAt: new Date(2_000), pausedAt: new Date(1_000) },
  });
  await expectError(
    await publish(failed.request.id, failed.input),
    409,
    "PUBLICATION_LIMIT_REACHED",
  );
  await expectDraft(failed.project!.id, failed.request.id);
  await db.publication.update({
    where: { projectId: a.project!.id },
    data: { pausedAt: null },
  });
  expect((await publish(failed.request.id, failed.input)).status).toBe(201);
});

test("rolls back address, snapshot and project changes when a later write fails", async () => {
  const { project, request, input } = await fixture(null);
  // Exercise PostgreSQL rollback after the snapshot has been inserted.
  const maxVersion = 2_147_483_647;
  await db.serviceRequest.update({
    where: { id: request.id },
    data: { requestVersion: maxVersion },
  });
  const key = randomUUID();
  await expectError(
    await publish(
      request.id,
      { ...input, expectedRequestVersion: maxVersion },
      admin,
      key,
    ),
    503,
    "SERVICE_UNAVAILABLE",
  );
  await expectDraft(project!.id, request.id);
  expect(
    await db.publication.findUnique({ where: { slug: input.slug } }),
  ).toBeNull();
  await db.serviceRequest.update({
    where: { id: request.id },
    data: { requestVersion: 1 },
  });
  expect((await publish(request.id, input, admin, key)).status).toBe(201);
});

test("documents the real publish endpoint as a private admin mutation", () => {
  const operation =
    createOpenApiDocument(app).paths["/api/v1/admin/requests/{id}/publish"]
      .post!;
  expect(operation.security).toEqual([{ session: [] }]);
  expect(
    operation.parameters?.map((value) => "name" in value && value.name),
  ).toEqual(expect.arrayContaining(["id", "X-CSRF-Token", "Idempotency-Key"]));
  expect(Object.keys(operation.responses)).toEqual(
    expect.arrayContaining(["200", "201", "403", "409", "422"]),
  );
});
