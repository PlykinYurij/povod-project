import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication, INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import sharp from "sharp";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { verifyDatabaseTarget } from "../../../../../scripts/database-safety.mjs";
import { csrfHeaders, TEST_ORIGIN } from "../../../tests/auth-client.mjs";
import type { ProjectDto } from "../projects/project.dto.js";
import type { ProjectPhotoDto } from "./project-photos.dto.js";

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
  PhotoWorkerModule,
}: typeof import("./photo-worker.module.js") = require("../../../dist/modules/media/photo-worker.module.js");
const {
  PhotoWorkerService,
}: typeof import("./photo-worker.service.js") = require("../../../dist/modules/media/photo-worker.service.js");
const {
  PhotoWorkQueue,
}: typeof import("./photo-work-queue.js") = require("../../../dist/modules/media/photo-work-queue.js");

let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let url: string;
let failStorage = false;
let failThumb = false;
let workerContext: INestApplicationContext | undefined;
let photo: Buffer;
const users: string[] = [];
const projects: string[] = [];
const requests: string[] = [];
const writes: {
  key: string;
  bytes: Buffer;
  signed: boolean;
  mime: string | undefined;
}[] = [];
const objects = new Map<string, Buffer>();
const storage = createServer(async (request, response) => {
  const key = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  if (request.method === "GET") {
    const bytes = objects.get(key);
    response.writeHead(
      bytes ? 200 : 404,
      bytes ? { "Content-Length": bytes.length } : {},
    );
    response.end(bytes);
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  if (failStorage || (failThumb && key.endsWith("/thumb.webp"))) {
    response.writeHead(503);
    response.end();
    return;
  }
  const bytes = Buffer.concat(chunks);
  objects.set(key, bytes);
  writes.push({
    key,
    bytes,
    signed:
      request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ") ?? false,
    mime: request.headers["content-type"],
  });
  response.writeHead(200, { ETag: '"local-fixture"' });
  response.end();
});

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  db = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  storage.listen(0, "127.0.0.1");
  await once(storage, "listening");
  const port = (storage.address() as AddressInfo).port;
  vi.stubEnv("WEB_ORIGIN", TEST_ORIGIN);
  vi.stubEnv("MEDIA_S3_ENDPOINT", "http://127.0.0.1:" + port);
  vi.stubEnv("MEDIA_S3_BUCKET", "synthetic-photo-test");
  vi.stubEnv("MEDIA_S3_REGION", "us-east-1");
  vi.stubEnv("AWS_PROFILE", "");
  vi.stubEnv("AWS_SESSION_TOKEN", "");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "synthetic");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "synthetic-test-only");
  app = await createApplication();
  workerContext = await NestFactory.createApplicationContext(
    PhotoWorkerModule,
    { logger: false, abortOnError: false },
  );
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
  photo = await sharp({
    create: { width: 24, height: 16, channels: 3, background: "#866542" },
  })
    .png()
    .toBuffer();
});

afterAll(async () => {
  await workerContext?.close();
  await app?.close();
  if (storage.listening)
    await new Promise<void>((done) => storage.close(() => done()));
  if (db) {
    await db.serviceRequest.deleteMany({ where: { id: { in: requests } } });
    await db.projectPhoto.deleteMany({
      where: { projectId: { in: projects } },
    });
    await db.project.deleteMany({ where: { id: { in: projects } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
  vi.unstubAllEnvs();
});

async function account(role: "ADMIN" | "USER" = "USER") {
  const user = await db.user.create({
    data: {
      email: `media-${randomUUID()}@example.test`,
      passwordHash: "synthetic-unused",
      role,
    },
  });
  users.push(user.id);
  const token = await db.$transaction((tx) =>
    app.get(SessionService).create(tx, user.id),
  );
  return { id: user.id, cookie: `povod-session=${token}` };
}

async function project(
  cookie: string,
  path = "/api/v1/projects",
  assisted = false,
) {
  const response = await fetch(url + path, {
    method: "POST",
    headers: {
      ...(await csrfHeaders(url, cookie)),
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      title: "Synthetic photo draft",
      templateVersionId: "wedding-garden-v1",
      ...(assisted ? { expectedRequestVersion: 1 } : {}),
    }),
  });
  expect(response.status).toBe(assisted ? 200 : 201);
  const draft = (await response.json()) as ProjectDto;
  projects.push(draft.id);
  return draft;
}

async function upload(
  path: string,
  cookie: string,
  bytes = photo,
  key = randomUUID(),
  extraField = false,
) {
  const body = new FormData();
  body.append(
    "file",
    new Blob([Uint8Array.from(bytes)], { type: "application/octet-stream" }),
    "untrusted-name.bin",
  );
  if (extraField) body.append("title", "unexpected");
  return fetch(url + path, {
    method: "POST",
    headers: {
      ...(await csrfHeaders(url, cookie)),
      Origin: TEST_ORIGIN,
      "Idempotency-Key": key,
    },
    body,
  });
}

test("owner upload checks access, derives the format and replays without a second S3 write", async () => {
  const [owner, other] = await Promise.all([account(), account()]);
  const draft = await project(owner.cookie);
  const path = `/api/v1/projects/${draft.id}/photos`;
  expect((await fetch(url + path)).status).toBe(401);
  expect((await upload(path, other.cookie)).status).toBe(404);
  expect(
    (await upload(path, owner.cookie, Buffer.from("not an image"))).status,
  ).toBe(415);
  expect(
    (await upload(path, owner.cookie, photo, randomUUID(), true)).status,
  ).toBe(400);
  const start = writes.length;
  const key = randomUUID();
  const response = await upload(path, owner.cookie, photo, key);
  expect(response.status).toBe(200);
  const record = (await response.json()) as ProjectPhotoDto;
  expect(record).toMatchObject({
    status: "PROCESSING",
    width: 24,
    height: 16,
    byteSize: photo.length,
  });
  expect(record).not.toHaveProperty("sha256");
  expect(writes.slice(start)).toEqual([
    {
      key: `/synthetic-photo-test/projects/${draft.id}/photos/${record.id}/original`,
      bytes: photo,
      signed: true,
      mime: "image/png",
    },
  ]);
  expect(await (await upload(path, owner.cookie, photo, key)).json()).toEqual(
    record,
  );
  expect(writes.length).toBe(start + 1);
  const otherPng = await sharp(photo).resize(3, 3).png().toBuffer();
  expect((await upload(path, owner.cookie, otherPng, key)).status).toBe(409);
  const list = await fetch(url + path, { headers: { Cookie: owner.cookie } });
  expect(list.headers.get("Cache-Control")).toBe("no-store");
  expect(await list.json()).toEqual({ items: [record] });
});

test("storage failure preserves the reservation for retry and the quota is enforced per project", async () => {
  const owner = await account();
  const draft = await project(owner.cookie);
  const path = `/api/v1/projects/${draft.id}/photos`;
  const key = randomUUID();
  failStorage = true;
  try {
    expect((await upload(path, owner.cookie, photo, key)).status).toBe(503);
  } finally {
    failStorage = false;
  }
  const pending = await db.projectPhoto.findFirstOrThrow({
    where: { projectId: draft.id },
  });
  expect(pending.status).toBe("UPLOADING");
  expect(
    await (await upload(path, owner.cookie, photo, key)).json(),
  ).toMatchObject({ id: pending.id, status: "PROCESSING" });
  for (let index = 1; index < 10; index++)
    expect((await upload(path, owner.cookie)).status).toBe(200);
  expect(await (await upload(path, owner.cookie)).json()).toMatchObject({
    error: { code: "PHOTO_LIMIT_REACHED" },
  });
  expect(await db.projectPhoto.count({ where: { projectId: draft.id } })).toBe(
    10,
  );
});

test("rejects oversized files and oversized images before writing storage", async () => {
  const owner = await account();
  const draft = await project(owner.cookie);
  const path = `/api/v1/projects/${draft.id}/photos`;
  const start = writes.length;
  expect(
    (await upload(path, owner.cookie, Buffer.alloc(15 * 1024 * 1024 + 1)))
      .status,
  ).toBe(413);
  const oversized = await sharp({
    create: { width: 7000, height: 6000, channels: 3, background: "#111" },
  })
    .png({ compressionLevel: 1 })
    .toBuffer();
  expect((await upload(path, owner.cookie, oversized)).status).toBe(422);
  expect(writes.length).toBe(start);
  expect(await db.projectPhoto.count({ where: { projectId: draft.id } })).toBe(
    0,
  );
}, 30_000);

test("operator can upload only through an assisted request", async () => {
  const [admin, ordinary] = await Promise.all([account("ADMIN"), account()]);
  const id = randomUUID();
  requests.push(id);
  const digest = id.replaceAll("-", "").repeat(2);
  await db.serviceRequest.create({
    data: {
      id,
      contactName: "Synthetic",
      phone: "+15550001277",
      contactChannel: "VK",
      contactValue: "synthetic-only",
      creationKeyHash: digest,
      creationPayloadHash: digest,
      consentAt: new Date(),
      consentVersion: "synthetic",
    },
  });
  const base = `/api/v1/admin/requests/${id}/project`;
  const draft = await project(admin.cookie, base, true);
  expect((await upload(base + "/photos", ordinary.cookie)).status).toBe(403);
  expect(
    (await upload(`/api/v1/projects/${draft.id}/photos`, admin.cookie)).status,
  ).toBe(404);
  expect((await upload(base + "/photos", admin.cookie)).status).toBe(200);
  expect(await db.projectPhoto.count({ where: { projectId: draft.id } })).toBe(
    1,
  );
});

test("Swagger describes multipart upload and cookie authentication", () => {
  const swagger = createOpenApiDocument(app);
  const operation = swagger.paths["/api/v1/projects/{id}/photos"]?.post;
  expect(operation?.security).toEqual([{ session: [] }]);
  expect(operation?.requestBody).toMatchObject({
    content: { "multipart/form-data": { schema: { required: ["file"] } } },
  });
});

test("worker recovers an expired lease and partial PUT, then writes oriented WebPs without EXIF", async () => {
  await db.projectPhoto.deleteMany({ where: { projectId: { in: projects } } });
  // Refuse to drive the global consumer when some other test data is in the queue.
  expect(await db.projectPhoto.count({ where: { status: "PROCESSING" } })).toBe(
    0,
  );
  const owner = await account();
  const draft = await project(owner.cookie);
  const path = `/api/v1/projects/${draft.id}/photos`;
  const jpeg = await sharp({
    create: { width: 1000, height: 500, channels: 3, background: "#866542" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  expect((await sharp(jpeg).metadata()).orientation).toBe(6);
  const response = await upload(path, owner.cookie, jpeg);
  expect(response.status).toBe(200);
  const { id } = (await response.json()) as ProjectPhotoDto;
  const queue = workerContext?.get(PhotoWorkQueue);
  const worker = workerContext?.get(PhotoWorkerService);
  if (!worker || !queue) throw new Error("Missing worker fixture");
  const claims = await Promise.all([queue.claim(), queue.claim()]);
  const [first] = claims.filter((claim) => !!claim);
  expect(claims.filter(Boolean)).toHaveLength(1);
  if (!first) throw new Error("Missing claimed fixture");
  expect(first.id).toBe(id);
  async function expireLease() {
    await db.projectPhoto.update({
      where: { id },
      data: { leaseUntil: new Date(0) },
    });
  }
  await expireLease();
  const start = writes.length;
  failThumb = true;
  try {
    expect(await worker.runOnce()).toBe(true);
  } finally {
    failThumb = false;
  }
  expect(writes.slice(start)).toHaveLength(1);
  const abandoned = writes[start].key;
  const waiting = await db.projectPhoto.findUniqueOrThrow({ where: { id } });
  expect(waiting).toMatchObject({
    status: "PROCESSING",
    processingAttempts: 2,
    renditionToken: null,
    leaseToken: null,
  });
  expect(waiting.leaseUntil?.getTime()).toBeGreaterThan(Date.now());
  await queue.ready(first, 50, 100);
  expect(await worker.runOnce()).toBe(false);
  await expireLease();
  expect(await worker.runOnce()).toBe(true);
  const saved = await db.projectPhoto.findUniqueOrThrow({ where: { id } });
  expect(saved).toMatchObject({
    status: "READY",
    renderWidth: 500,
    renderHeight: 1000,
    leaseUntil: null,
    processingAttempts: 3,
  });
  const output = writes.slice(-2);
  const prefix = `/synthetic-photo-test/projects/${draft.id}/photos/${id}/renditions/${saved.renditionToken}/`;
  expect(output.map(({ key }) => key)).toEqual([
    prefix + "display.webp",
    prefix + "thumb.webp",
  ]);
  expect(output[0].key).not.toBe(abandoned);
  expect(await sharp(output[0].bytes).metadata()).toMatchObject({
    format: "webp",
    width: 500,
    height: 1000,
  });
  const thumb = await sharp(output[1].bytes).metadata();
  expect(thumb).toMatchObject({ format: "webp", width: 240, height: 480 });
  expect(thumb.exif).toBeUndefined();
  expect((await sharp(output[0].bytes).metadata()).exif).toBeUndefined();
  const list = await fetch(url + path, { headers: { Cookie: owner.cookie } });
  expect(await list.json()).toMatchObject({
    items: [{ id, status: "READY", width: 500, height: 1000 }],
  });
  expect(await worker.runOnce()).toBe(false);
});

test("worker fails mismatched bytes permanently and closes an expired final attempt", async () => {
  const worker = workerContext?.get(PhotoWorkerService);
  const queue = workerContext?.get(PhotoWorkQueue);
  if (!worker || !queue) throw new Error("Missing worker fixture");
  expect(await db.projectPhoto.count({ where: { status: "PROCESSING" } })).toBe(
    0,
  );
  const owner = await account();
  const draft = await project(owner.cookie);
  const path = `/api/v1/projects/${draft.id}/photos`;
  const response = await upload(path, owner.cookie);
  expect(response.status).toBe(200);
  const first = (await response.json()) as ProjectPhotoDto;
  objects.set(writes.at(-1)!.key, Buffer.from("wrong object"));
  const start = writes.length;
  expect(await worker.runOnce()).toBe(true);
  expect(
    await db.projectPhoto.findUniqueOrThrow({ where: { id: first.id } }),
  ).toMatchObject({
    status: "FAILED",
    processingAttempts: 1,
    renditionToken: null,
  });
  expect(writes.length).toBe(start);
  const next = await upload(path, owner.cookie);
  expect(next.status).toBe(200);
  const second = (await next.json()) as ProjectPhotoDto;
  await db.projectPhoto.update({
    where: { id: second.id },
    data: {
      processingAttempts: 3,
      leaseToken: randomUUID(),
      leaseUntil: new Date(0),
    },
  });
  expect(await queue.claim()).toBeUndefined();
  expect(
    await db.projectPhoto.findUniqueOrThrow({ where: { id: second.id } }),
  ).toMatchObject({
    status: "FAILED",
    leaseUntil: null,
    leaseToken: null,
  });
});
