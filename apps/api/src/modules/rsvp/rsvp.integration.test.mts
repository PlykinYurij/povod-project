import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { verifyDatabaseTarget } from "../../../../../scripts/database-safety.mjs";

const require = createRequire(import.meta.url);
const {
  createApplication,
  createOpenApiDocument,
}: typeof import("../../create-application.js") = require("../../../dist/create-application.js");
const {
  createDatabaseClient,
}: typeof import("../../database/create-database-client.js") = require("../../../dist/database/create-database-client.js");

let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let origin: string;
const projectIds: string[] = [];
const publicationIds: string[] = [];

beforeAll(async () => {
  const url = process.env.POVOD_TEST_DATABASE_URL!;
  await verifyDatabaseTarget(url, "test", process.env.POVOD_TEST_DATABASE);
  db = createDatabaseClient(url);
  vi.stubEnv("RSVP_RATE_SECRET", "1b".repeat(32));
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  if (db) {
    const publicationId = { in: publicationIds };
    try {
      await db.rsvpResponse.deleteMany({ where: { publicationId } });
      await db.publicationSnapshot.deleteMany({ where: { publicationId } });
      await db.publication.deleteMany({ where: { id: publicationId } });
      await db.project.deleteMany({ where: { id: { in: projectIds } } });
    } finally {
      await db.$disconnect();
    }
  }
  vi.unstubAllEnvs();
});

async function fixture() {
  const project = await db.project.create({
    data: {
      templateVersionId: "wedding-garden-v1",
      title: "Synthetic RSVP",
      content: {},
      creationKeyHash: "a".repeat(64),
      creationPayloadHash: "b".repeat(64),
    },
  });
  projectIds.push(project.id);
  const publication = await db.publication.create({
    data: {
      projectId: project.id,
      slug: `rsvp-${randomUUID()}`,
      visible: true,
      expiresAt: new Date(Date.now() + 60 * 60_000),
      snapshots: {
        create: {
          projectRevision: project.revision,
          content: { fixture: "not public form data" },
          formSchema: "garden_v1",
        },
      },
    },
    include: { snapshots: true },
  });
  publicationIds.push(publication.id);
  const formVersionId = publication.snapshots[0].id;
  return {
    projectId: project.id,
    publicationId: publication.id,
    formVersionId,
    path: `${origin}/api/v1/public/invitations/by-address/${publication.slug}/rsvp`,
    body: { formVersionId, name: "Гость", attendance: "yes", companions: 2 },
  };
}

function submit(path: string, body: unknown, key: string = randomUUID()) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ error: { code } });
}

test("publishes a cookie-free form contract without including the project snapshot", async () => {
  const { path, formVersionId } = await fixture();
  const response = await fetch(path);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(await response.json()).toEqual({
    formVersionId,
    schema: "garden-v1",
    nameMaxLength: 80,
    maxCompanions: 2,
  });
  const documented =
    createOpenApiDocument(app).paths[
      "/api/v1/public/invitations/by-address/{slug}/rsvp"
    ];
  expect(Object.keys(documented.post!.responses)).toEqual(
    expect.arrayContaining(["200", "201", "404", "409", "422", "429", "503"]),
  );
  expect(documented.post!.security).toBeUndefined();
});

test("validates content, accepted and declined requests, and replays one immutable receipt", async () => {
  const { path, body, publicationId } = await fixture();
  for (const invalid of [
    { ...body, ownerId: randomUUID() },
    { ...body, name: "   " },
    { ...body, name: "a".repeat(81) },
    { ...body, name: "a\u0000b" },
    { ...body, name: "\uD800" },
    { ...body, attendance: true },
    { ...body, attendance: "no" },
    { ...body, companions: "0" },
    { ...body, companions: 1.5 },
  ]) {
    await expectError(await submit(path, invalid), 422, "VALIDATION_FAILED");
  }
  await expectError(
    await submit(path, body, "bad key"),
    422,
    "VALIDATION_FAILED",
  );
  await expectError(
    await submit(path + "?projectId=x", body),
    422,
    "VALIDATION_FAILED",
  );
  const key = randomUUID();
  const unicodeName = "🌿".repeat(80);
  const [a, b] = await Promise.all([
    submit(path, { ...body, name: " " + unicodeName }, key),
    submit(path, { ...body, name: unicodeName }, key.toUpperCase()),
  ]);
  expect([a.status, b.status].sort()).toEqual([200, 201]);
  const receipt = await a.json();
  expect(receipt).toEqual({
    receivedAt: expect.any(String),
    responseId: expect.any(String),
  });
  expect(await b.json()).toEqual(receipt);
  await expectError(
    await submit(path, { ...body, name: "other" }, key),
    409,
    "IDEMPOTENCY_KEY_REUSED",
  );
  const declined = await submit(path, {
    ...body,
    name: unicodeName,
    attendance: "no",
    companions: 0,
  });
  expect(declined.status).toBe(201);
  const stored = await db.rsvpResponse.findMany({
    where: { publicationId },
    orderBy: { attendance: "desc" },
  });
  expect(
    stored.map(({ name, attendance, companions }) => [
      name,
      attendance,
      companions,
    ]),
  ).toEqual([
    [unicodeName, "no", 0],
    [unicodeName, "yes", 2],
  ]);
});

test("rejects stale forms and keeps previous responses and receipts across snapshots", async () => {
  const { path, body, publicationId, formVersionId } = await fixture();
  const key = randomUUID();
  const old = await submit(path, body, key);
  expect(old.status).toBe(201);
  const updated = await db.$transaction(async (tx) => {
    await tx.publicationSnapshot.update({
      where: { id: formVersionId },
      data: { supersededAt: new Date() },
    });
    return tx.publicationSnapshot.create({
      data: {
        publicationId,
        projectRevision: 2,
        content: {},
        formSchema: "garden_v1",
      },
    });
  });
  expect(await (await fetch(path)).json()).toMatchObject({
    formVersionId: updated.id,
  });
  await expectError(await submit(path, body), 409, "RSVP_FORM_CHANGED");
  const retry = await submit(path, body, key);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toEqual(await old.json());
  expect(
    (await submit(path, { ...body, formVersionId: updated.id })).status,
  ).toBe(201);
  expect(await db.rsvpResponse.count({ where: { publicationId } })).toBe(2);
});

test("closes the form and any writes or replays for hidden, expired, or deleted projects", async () => {
  const { path, body, publicationId, projectId } = await fixture();
  const key = randomUUID();
  expect((await submit(path, body, key)).status).toBe(201);
  const future = new Date(Date.now() + 60 * 60_000);
  async function assertClosed(target = path) {
    await expectError(await fetch(target), 404, "INVITATION_UNAVAILABLE");
    await expectError(
      await submit(target, body),
      404,
      "INVITATION_UNAVAILABLE",
    );
    await expectError(
      await submit(target, body, key),
      404,
      "INVITATION_UNAVAILABLE",
    );
  }
  await assertClosed(path.replace(/rsvp-[a-f0-9-]+/, "unassigned"));
  await db.publication.update({
    where: { id: publicationId },
    data: { visible: false },
  });
  await assertClosed();
  await db.publication.update({
    where: { id: publicationId },
    data: { visible: true, expiresAt: new Date(0) },
  });
  await assertClosed();
  await db.publication.update({
    where: { id: publicationId },
    data: { expiresAt: future },
  });
  await db.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });
  await assertClosed();
  expect(await db.rsvpResponse.count({ where: { publicationId } })).toBe(1);
});

test("serializes two submissions competing for the last stored response", async () => {
  const { path, body, publicationId, formVersionId } = await fixture();
  await db.rsvpResponse.createMany({
    data: Array.from({ length: 299 }, (_, i) => ({
      publicationId,
      formVersionId,
      keyHash: createHash("sha256").update(String(i)).digest("hex"),
      name: "Synthetic guest",
      attendance: "yes",
      companions: 0,
    })),
  });
  const responses = await Promise.all([submit(path, body), submit(path, body)]);
  expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
  const blocked = responses.find(({ status }) => status === 409)!;
  await expectError(blocked, 409, "RSVP_LIMIT_REACHED");
  expect(await db.rsvpResponse.count({ where: { publicationId } })).toBe(300);
});

test("rate-buckets per project, ignore forged forwarded IP, replay at the limit, and roll over", async () => {
  const { path, body, publicationId } = await fixture();
  const key = randomUUID();
  expect((await submit(path, body, key)).status).toBe(201);
  for (let attempt = 1; attempt < 30; attempt++) {
    expect((await submit(path, body)).status).toBe(201);
  }
  const blocked = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
      "X-Forwarded-For": "203.0.113.1",
    },
    body: JSON.stringify(body),
  });
  expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  await expectError(blocked, 429, "RATE_LIMITED");
  expect((await submit(path, body, key)).status).toBe(200);
  const other = await fixture();
  expect((await submit(other.path, other.body, key)).status).toBe(201);
  const counters = await db.rsvpRateLimit.findMany({
    where: { publicationId },
  });
  expect(counters).toHaveLength(1);
  expect(counters[0].clientKey).toMatch(/^[a-f0-9]{64}$/);
  expect(counters[0].count).toBe(31);
  await db.rsvpRateLimit.updateMany({
    where: { publicationId },
    data: { expiresAt: new Date(0) },
  });
  expect((await submit(path, body)).status).toBe(201);
  expect(await db.rsvpResponse.count({ where: { publicationId } })).toBe(31);
});
