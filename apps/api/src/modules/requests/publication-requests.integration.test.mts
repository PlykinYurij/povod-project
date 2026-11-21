import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Template } from "../../database/generated/client.js";
import type { ProjectDto } from "../projects/project.dto.js";
import type {
  CreatePublicationRequestDto,
  ProjectPublicationRequestDto,
} from "./publication-request.dto.js";
import type { ServiceRequestReceiptDto } from "./service-request.dto.js";
import type { ApiErrorDto } from "../../http/api-error.js";
import { verifyDatabaseTarget } from "../../../../../scripts/database-safety.mjs";
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
const {
  RequestClock,
}: typeof import("./request-clock.js") = require("../../../dist/modules/requests/request-clock.js");
const {
  RequestRateService,
}: typeof import("./request-rate.service.js") = require("../../../dist/modules/requests/request-rate.service.js");
const {
  publicationKeyHash,
  requestRateKey,
}: typeof import("./request-digests.js") = require("../../../dist/modules/requests/request-digests.js");
const secret = randomBytes(32);
const userIds: string[] = [];
const hashes = new Set<string>();
const phones = new Set<string>();
let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let url: string;
let template: Template;
let now = Date.now();
let sequence = 0;

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  vi.stubEnv("WEB_ORIGIN", TEST_ORIGIN);
  vi.stubEnv("SERVICE_REQUEST_RATE_SECRET", secret.toString("hex"));
  db = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  template = await db.template.findUniqueOrThrow({
    where: { id: "quiet-garden" },
  });
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
});
beforeEach(() => {
  now += 2 * 60 * 60_000;
  vi.spyOn(app.get(RequestClock), "now").mockImplementation(
    () => new Date(now),
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (db && template)
    await db.template.update({ where: { id: template.id }, data: template });
});
afterAll(async () => {
  await app?.close();
  if (db) {
    await db.serviceRequest.deleteMany({
      where: { creationKeyHash: { in: [...hashes] } },
    });
    const rateKeys = [...phones].map((phone) =>
      requestRateKey(secret, "phone", phone),
    );
    rateKeys.push(
      ...["127.0.0.1", "::ffff:127.0.0.1"].map((ip) =>
        requestRateKey(secret, "ip", ip),
      ),
    );
    await db.serviceRequestRateLimit.deleteMany({
      where: { key: { in: rateKeys } },
    });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
  vi.unstubAllEnvs();
});

async function owner() {
  const user = await db.user.create({
    data: {
      email: `publication-request-${randomUUID()}@example.test`,
      passwordHash: "synthetic-unused-hash",
      emailVerifiedAt: new Date(),
    },
  });
  userIds.push(user.id);
  const token = await db.$transaction((tx) =>
    app.get(SessionService).create(tx, user.id),
  );
  return { id: user.id, cookie: `povod-session=${token}` };
}
type Actor = Awaited<ReturnType<typeof owner>>;

async function project(actor: Actor) {
  const response = await fetch(url + "/api/v1/projects", {
    method: "POST",
    headers: {
      ...(await csrfHeaders(url, actor.cookie)),
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      templateVersionId: "wedding-garden-v1",
      title: "Request fixture",
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as ProjectDto;
}
async function inputFor(
  project: ProjectDto,
): Promise<CreatePublicationRequestDto> {
  const current = await db.template.findUniqueOrThrow({
    where: { id: "quiet-garden" },
  });
  return {
    projectId: project.id,
    expectedRevision: project.revision,
    expectedPriceVersion:
      current.priceMinor === null ? null : current.priceVersion,
    contactName: "Synthetic owner",
    phone: `+1556${String(++sequence).padStart(7, "0")}`,
    contactChannel: "TELEGRAM",
    contactValue: "@synthetic",
    privacyConsent: true,
  };
}
async function submit(
  actor: Actor,
  input: CreatePublicationRequestDto | Record<string, unknown>,
  key = randomUUID(),
  base = url,
) {
  hashes.add(publicationKeyHash(actor.id, key));
  if (typeof input.phone === "string") phones.add(input.phone);
  return fetch(base + "/api/v1/publication-requests", {
    method: "POST",
    headers: {
      ...(await csrfHeaders(base, actor.cookie)),
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(input),
  });
}
function state(actor: Actor, id: string, query = "") {
  return fetch(`${url}/api/v1/projects/${id}/publication-request${query}`, {
    headers: { Cookie: actor.cookie },
  });
}
async function save(actor: Actor, project: ProjectDto) {
  const response = await fetch(`${url}/api/v1/projects/${project.id}/draft`, {
    method: "PATCH",
    headers: {
      ...(await csrfHeaders(url, actor.cookie)),
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expectedRevision: project.revision,
      title: "Edited while waiting",
      content: project.content,
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as ProjectDto;
}

test("own request captures basis without publishing or freezing the draft", async () => {
  const actor = await owner();
  const draft = await project(actor);
  const input = await inputFor(draft);
  const response = await submit(actor, input);
  expect(response.status).toBe(201);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const receipt = (await response.json()) as ServiceRequestReceiptDto;
  const row = await db.serviceRequest.findUniqueOrThrow({
    where: { id: receipt.requestId },
  });
  expect(row).toMatchObject({
    kind: "PUBLICATION",
    customerUserId: actor.id,
    projectId: draft.id,
    submittedRevision: draft.revision,
    status: "NEW",
  });
  const edited = await save(actor, draft);
  const status = await state(actor, draft.id);
  const body = (await status.json()) as ProjectPublicationRequestDto;
  expect(body.request).toMatchObject({
    requestId: receipt.requestId,
    submittedRevision: 1,
    currentProjectRevision: 2,
    status: "NEW",
  });
  expect(edited.firstPublishedAt).toBeNull();
  expect(edited.canEditDraft).toBe(true);
  expect(JSON.stringify(body)).not.toMatch(
    /contactName|phone|creationKeyHash|customerUserId/,
  );
});

test("guest/CSRF failures cannot submit even with a valid project UUID", async () => {
  const actor = await owner();
  const input = await inputFor(await project(actor));
  const guest = await fetch(url + "/api/v1/publication-requests", {
    method: "POST",
    headers: {
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(input),
  });
  expect(guest.status).toBe(401);
  const noCsrf = await fetch(url + "/api/v1/publication-requests", {
    method: "POST",
    headers: {
      Cookie: actor.cookie,
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(input),
  });
  expect(noCsrf.status).toBe(403);
  expect(
    (
      await fetch(
        `${url}/api/v1/projects/${input.projectId}/publication-request`,
      )
    ).status,
  ).toBe(401);
});

test("foreign, absent and deleted projects are neutral 404, including an ADMIN actor", async () => {
  const a = await owner();
  const b = await owner();
  const draft = await project(a);
  const input = await inputFor(draft);
  await db.user.update({ where: { id: b.id }, data: { role: "ADMIN" } });
  expect((await submit(b, input)).status).toBe(404);
  expect((await state(b, draft.id)).status).toBe(404);
  expect((await submit(a, { ...input, projectId: randomUUID() })).status).toBe(
    404,
  );
  await db.project.update({
    where: { id: draft.id },
    data: { deletedAt: new Date() },
  });
  expect((await submit(a, input)).status).toBe(404);
  expect((await state(a, draft.id)).status).toBe(404);
});

test("stale draft revision fails before recording a request", async () => {
  const actor = await owner();
  const draft = await project(actor);
  const input = await inputFor(draft);
  await save(actor, draft);
  const response = await submit(actor, input);
  expect(response.status).toBe(409);
  expect(((await response.json()) as ApiErrorDto).error.code).toBe(
    "REVISION_CONFLICT",
  );
  expect(
    (
      (await (
        await state(actor, draft.id)
      ).json()) as ProjectPublicationRequestDto
    ).request,
  ).toBeNull();
});

test("original key replays after edits/price changes; changed body conflicts", async () => {
  const actor = await owner();
  const draft = await project(actor);
  const input = await inputFor(draft);
  const key = randomUUID();
  const first = await submit(actor, input, key);
  const receipt = await first.json();
  await save(actor, draft);
  await db.template.update({
    where: { id: template.id },
    data: { priceMinor: 123400, priceVersion: { increment: 1 } },
  });
  const replay = await submit(actor, input, key);
  expect(replay.status).toBe(200);
  expect(await replay.json()).toEqual(receipt);
  const conflict = await submit(
    actor,
    { ...input, contactName: "Changed" },
    key,
  );
  expect(conflict.status).toBe(409);
  expect(((await conflict.json()) as ApiErrorDto).error.code).toBe(
    "IDEMPOTENCY_KEY_REUSED",
  );
});

test("same UUID is isolated by customer namespace", async () => {
  const a = await owner();
  const b = await owner();
  const key = randomUUID();
  const first = await submit(a, await inputFor(await project(a)), key);
  const second = await submit(b, await inputFor(await project(b)), key);
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(((await first.json()) as ServiceRequestReceiptDto).requestId).not.toBe(
    ((await second.json()) as ServiceRequestReceiptDto).requestId,
  );
});

test("competing keys create one active request; same-key race returns one receipt", async () => {
  const actor = await owner();
  const input = await inputFor(await project(actor));
  const raced = await Promise.all([submit(actor, input), submit(actor, input)]);
  expect(raced.map((response) => response.status).sort()).toEqual([201, 409]);
  const denied = raced.find((response) => response.status === 409)!;
  expect(((await denied.json()) as ApiErrorDto).error.code).toBe(
    "REQUEST_ALREADY_OPEN",
  );
  const next = await inputFor(await project(actor));
  const key = randomUUID();
  const repeated = await Promise.all([
    submit(actor, next, key),
    submit(actor, next, key),
  ]);
  expect(repeated.map((response) => response.status).sort()).toEqual([
    200, 201,
  ]);
  expect(await repeated[0].json()).toEqual(await repeated[1].json());
});

test("two app instances preserve the project request invariant", async () => {
  const actor = await owner();
  const input = await inputFor(await project(actor));
  const second = await createApplication();
  try {
    await second.listen(0, "127.0.0.1");
    vi.spyOn(second.get(RequestClock), "now").mockImplementation(
      () => new Date(now),
    );
    const key = randomUUID();
    const result = await Promise.all([
      submit(actor, input, key),
      submit(actor, input, key, await second.getUrl()),
    ]);
    expect(result.map((response) => response.status).sort()).toEqual([
      200, 201,
    ]);
  } finally {
    await second.close();
  }
});

test("save racing with intake yields a coherent basis and never locks later editing", async () => {
  const actor = await owner();
  const draft = await project(actor);
  const input = await inputFor(draft);
  const [request, edited] = await Promise.all([
    submit(actor, input),
    save(actor, draft),
  ]);
  expect([201, 409]).toContain(request.status);
  const status = (await (
    await state(actor, draft.id)
  ).json()) as ProjectPublicationRequestDto;
  expect(edited.revision).toBe(2);
  if (request.status === 201)
    expect(status.request).toMatchObject({
      submittedRevision: 1,
      currentProjectRevision: 2,
    });
  else expect(status.request).toBeNull();
});

test("quote is snapshotted and current price can change independently", async () => {
  await db.template.update({
    where: { id: template.id },
    data: { priceMinor: 123456, priceVersion: 10 },
  });
  const actor = await owner();
  const draft = await project(actor);
  expect((await submit(actor, await inputFor(draft))).status).toBe(201);
  await db.template.update({
    where: { id: template.id },
    data: { priceMinor: 654321, priceVersion: 11 },
  });
  const body = (await (
    await state(actor, draft.id)
  ).json()) as ProjectPublicationRequestDto;
  expect(body.currentPrice).toEqual({
    amountMinor: 654321,
    currency: "RUB",
    version: 11,
  });
  expect(body.request?.price).toEqual({
    amountMinor: 123456,
    currency: "RUB",
    version: 10,
  });
});

test("stale or unacknowledged configured quote fails with PRICE_CHANGED", async () => {
  const actor = await owner();
  const draft = await project(actor);
  const input = await inputFor(draft);
  await db.template.update({
    where: { id: template.id },
    data: { priceMinor: 50000, priceVersion: 20 },
  });
  const response = await submit(actor, input);
  expect(response.status).toBe(409);
  expect(((await response.json()) as ApiErrorDto).error.code).toBe(
    "PRICE_CHANGED",
  );
  expect(
    (
      (await (
        await state(actor, draft.id)
      ).json()) as ProjectPublicationRequestDto
    ).request,
  ).toBeNull();
});

test("retired catalog entry still provides a private quote for its existing project", async () => {
  const actor = await owner();
  const draft = await project(actor);
  await db.template.update({
    where: { id: template.id },
    data: { active: false, priceMinor: 10000, priceVersion: 12 },
  });
  const status = (await (
    await state(actor, draft.id)
  ).json()) as ProjectPublicationRequestDto;
  expect(status.currentPrice).toEqual({
    amountMinor: 10000,
    currency: "RUB",
    version: 12,
  });
  expect((await submit(actor, await inputFor(draft))).status).toBe(201);
});

test.each([
  { expectedRevision: 0 },
  { expectedRevision: "1" },
  { expectedPriceVersion: "null" },
  { expectedPriceVersion: 1.5 },
  { role: "ADMIN" },
  { ownerId: randomUUID() },
  { priceSnapshotMinor: 0 },
])("invalid basis/server fields are rejected: %j", async (extra) => {
  const actor = await owner();
  const input = await inputFor(await project(actor));
  expect((await submit(actor, { ...input, ...extra })).status).toBe(422);
});

test("published fixture cannot open a new request, while prior key still replays", async () => {
  const actor = await owner();
  const draft = await project(actor);
  const input = await inputFor(draft);
  const key = randomUUID();
  expect((await submit(actor, input, key)).status).toBe(201);
  await db.project.update({
    where: { id: draft.id },
    data: { firstPublishedAt: new Date() },
  });
  expect((await submit(actor, input, key)).status).toBe(200);
  const denied = await submit(actor, input);
  expect(denied.status).toBe(409);
  expect(((await denied.json()) as ApiErrorDto).error.code).toBe(
    "CONTENT_LOCKED",
  );
});

test("request state rejects extra queries and does not replace empty data with missing project", async () => {
  const actor = await owner();
  const draft = await project(actor);
  const empty = await state(actor, draft.id);
  expect(await empty.json()).toEqual({
    currentPrice:
      template.priceMinor === null
        ? null
        : {
            amountMinor: template.priceMinor,
            currency: "RUB",
            version: template.priceVersion,
          },
    request: null,
    lastClosed: null,
  });
  expect((await state(actor, draft.id, "?ownerId=forged")).status).toBe(422);
  expect((await state(actor, "invalid")).status).toBe(422);
});

test("SQL refuses an incomplete price snapshot", async () => {
  const actor = await owner();
  const response = await submit(actor, await inputFor(await project(actor)));
  const receipt = (await response.json()) as ServiceRequestReceiptDto;
  await expect(
    db.serviceRequest.update({
      where: { id: receipt.requestId },
      data: {
        priceSnapshotMinor: 10,
        priceSnapshotCurrency: null,
        priceSnapshotVersion: null,
      },
    }),
  ).rejects.toThrow();
});

test("private rate denial commits counters without recording a fourth order", async () => {
  const actor = await owner();
  const firstProject = await project(actor);
  const firstInput = await inputFor(firstProject);
  const firstKey = randomUUID();
  expect((await submit(actor, firstInput, firstKey)).status).toBe(201);
  for (let index = 0; index < 2; index++) {
    const next = await inputFor(await project(actor));
    expect(
      (await submit(actor, { ...next, phone: firstInput.phone })).status,
    ).toBe(201);
  }
  const fourthProject = await project(actor);
  const fourth = await submit(actor, {
    ...(await inputFor(fourthProject)),
    phone: firstInput.phone,
  });
  expect(fourth.status).toBe(429);
  expect(Number(fourth.headers.get("Retry-After"))).toBe(3600);
  expect(
    (
      (await (
        await state(actor, fourthProject.id)
      ).json()) as ProjectPublicationRequestDto
    ).request,
  ).toBeNull();
  expect((await submit(actor, firstInput, firstKey)).status).toBe(200);
});

test("failure after rate write rolls back the order and releases owner/project locks", async () => {
  const actor = await owner();
  const draft = await project(actor);
  const input = await inputFor(draft);
  const rate = app.get(RequestRateService);
  const reserve = rate.reserve.bind(rate);
  vi.spyOn(rate, "reserve").mockImplementationOnce(async (...args) => {
    await reserve(...args);
    throw new Error("Synthetic private intake failure");
  });
  expect((await submit(actor, input)).status).toBe(503);
  expect(
    (
      (await (
        await state(actor, draft.id)
      ).json()) as ProjectPublicationRequestDto
    ).request,
  ).toBeNull();
  expect(
    await db.serviceRequestRateLimit.findUnique({
      where: { key: requestRateKey(secret, "phone", input.phone) },
    }),
  ).toBeNull();
  expect((await save(actor, draft)).revision).toBe(2);
});

test("OpenAPI advertises private cookie/CSRF and nullable current/request prices", () => {
  const doc = createOpenApiDocument(app);
  expect(doc.paths["/api/v1/publication-requests"]?.post?.security).toEqual([
    { session: [] },
  ]);
  expect(
    doc.paths["/api/v1/projects/{id}/publication-request"]?.get?.operationId,
  ).toBe("getProjectPublicationRequest");
  expect(doc.components?.schemas).toHaveProperty(
    "ProjectPublicationRequestDto",
  );
});
