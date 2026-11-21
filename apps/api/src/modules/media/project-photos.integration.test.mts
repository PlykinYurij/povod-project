import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
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

let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let url: string;
let failStorage = false;
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
const storage = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  if (failStorage) {
    response.writeHead(503);
    response.end();
    return;
  }
  writes.push({
    key: new URL(request.url ?? "/", "http://127.0.0.1").pathname,
    bytes: Buffer.concat(chunks),
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
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
  photo = await sharp({
    create: { width: 24, height: 16, channels: 3, background: "#866542" },
  })
    .png()
    .toBuffer();
});

afterAll(async () => {
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
