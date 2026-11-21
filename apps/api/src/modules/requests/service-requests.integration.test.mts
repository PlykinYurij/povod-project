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
import type { ServiceRequestReceiptDto } from "./service-request.dto.js";
import type { ApiErrorDto } from "../../http/api-error.js";
import { verifyDatabaseTarget } from "../../../../../scripts/database-safety.mjs";
import { TEST_ORIGIN } from "../../../tests/auth-client.mjs";

const require = createRequire(import.meta.url);
const {
  createApplication,
  createOpenApiDocument,
}: typeof import("../../create-application.js") = require("../../../dist/create-application.js");
const {
  createDatabaseClient,
}: typeof import("../../database/create-database-client.js") = require("../../../dist/database/create-database-client.js");
const {
  RequestClock,
}: typeof import("./request-clock.js") = require("../../../dist/modules/requests/request-clock.js");
const {
  RequestRateService,
}: typeof import("./request-rate.service.js") = require("../../../dist/modules/requests/request-rate.service.js");
const {
  assistanceKeyHash,
  requestRateKey,
  requestRateSecret,
}: typeof import("./request-digests.js") = require("../../../dist/modules/requests/request-digests.js");
const {
  normalizePhone,
}: typeof import("./contact-input.js") = require("../../../dist/modules/requests/contact-input.js");
const {
  SessionService,
}: typeof import("../identity/session.service.js") = require("../../../dist/modules/identity/session.service.js");
const secret = randomBytes(32);
const keys = new Set<string>();
const phones = new Set<string>();
const users: string[] = [];
let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let url: string;
let sequence = 0;
let now = Date.now();
const nextPhone = () => `+1555${String(++sequence).padStart(7, "0")}`;

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  vi.stubEnv("WEB_ORIGIN", TEST_ORIGIN);
  vi.stubEnv("SERVICE_REQUEST_RATE_SECRET", secret.toString("hex"));
  db = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
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
afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await app?.close();
  if (db) {
    await db.serviceRequest.deleteMany({
      where: { creationKeyHash: { in: [...keys].map(assistanceKeyHash) } },
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
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
  vi.unstubAllEnvs();
});

function payload() {
  return {
    contactName: "Synthetic client",
    phone: nextPhone(),
    contactChannel: "TELEGRAM",
    contactValue: "@synthetic-example",
    privacyConsent: true,
  };
}

async function submit(
  input: unknown = payload(),
  options: {
    key?: string | null;
    origin?: string | null;
    contentType?: string;
    headers?: Record<string, string>;
    rawBody?: string;
    query?: string;
    base?: string;
  } = {},
) {
  const key = options.key === undefined ? randomUUID() : options.key;
  if (key) keys.add(key);
  if (input && typeof input === "object" && "phone" in input) {
    const phone = normalizePhone(input.phone);
    if (typeof phone === "string") phones.add(phone);
  }
  return fetch(
    (options.base ?? url) + "/api/v1/service-requests" + (options.query ?? ""),
    {
      method: "POST",
      headers: {
        "Content-Type": options.contentType ?? "application/json",
        ...(options.origin === null
          ? {}
          : { Origin: options.origin ?? TEST_ORIGIN }),
        ...(key ? { "Idempotency-Key": key } : {}),
        ...options.headers,
      },
      body: options.rawBody ?? JSON.stringify(input),
    },
  );
}

test("anonymous submission stores only an assistance request and returns a minimal receipt", async () => {
  const userCount = await db.user.count();
  const projectCount = await db.project.count();
  const input = payload();
  const response = await submit(input);
  expect(response.status).toBe(201);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Set-Cookie")).toBeNull();
  const receipt = (await response.json()) as ServiceRequestReceiptDto;
  expect(Object.keys(receipt).sort()).toEqual([
    "createdAt",
    "requestId",
    "status",
  ]);
  expect(receipt.status).toBe("RECEIVED");
  const stored = await db.serviceRequest.findUniqueOrThrow({
    where: { id: receipt.requestId },
  });
  expect(stored).toMatchObject({
    kind: "ASSISTANCE",
    customerUserId: null,
    projectId: null,
    submittedRevision: null,
    status: "NEW",
    requestVersion: 1,
    contactName: input.contactName,
    phone: input.phone,
    consentVersion: "contact-request-v1",
  });
  expect(stored.consentAt).toEqual(new Date(now));
  expect(await db.user.count()).toBe(userCount);
  expect(await db.project.count()).toBe(projectCount);
});

test.each(["TELEGRAM", "MAX", "VK"])(
  "channel %s accepts a plain contact without an external lookup",
  async (contactChannel) => {
    const response = await submit({
      ...payload(),
      contactChannel,
      contactValue: "https://example.test/synthetic-profile",
    });
    expect(response.status).toBe(201);
  },
);

test("phone/name normalization makes a retry equivalent without rewriting source data", async () => {
  const key = randomUUID();
  const input = {
    ...payload(),
    contactName: "  Синтетический клиент  ",
    phone: "8 (999) 123-45-67",
    contactValue: " @synthetic ",
  };
  const first = await submit(input, { key });
  expect(first.status).toBe(201);
  const receipt = (await first.json()) as ServiceRequestReceiptDto;
  const repeated = await submit(
    {
      ...input,
      contactName: input.contactName.trim(),
      phone: "+79991234567",
      contactValue: "@synthetic",
    },
    { key: key.toUpperCase() },
  );
  expect(repeated.status).toBe(200);
  expect(await repeated.json()).toEqual(receipt);
  const stored = await db.serviceRequest.findUniqueOrThrow({
    where: { id: receipt.requestId },
  });
  expect(stored.phone).toBe("+79991234567");
  expect(stored.contactName).toBe(input.contactName.trim());
  await db.serviceRequest.update({
    where: { id: receipt.requestId },
    data: { status: "COMPLETED", requestVersion: { increment: 1 } },
  });
  const laterReplay = await submit(input, { key });
  expect(laterReplay.status).toBe(200);
  expect(await laterReplay.json()).toEqual(receipt);
});

test.each([
  { contactName: "" },
  { contactName: "a".repeat(81) },
  { contactName: "bad\u0000name" },
  { phone: "123" },
  { phone: "+0000123456" },
  { contactChannel: "EMAIL" },
  { contactValue: "" },
  { contactValue: "a".repeat(201) },
  { contactValue: "<script>bad</script>" },
  { contactValue: "bad\ud800value" },
  { privacyConsent: false },
  { privacyConsent: "true" },
  { projectId: randomUUID() },
  { customerUserId: randomUUID() },
  { status: "COMPLETED" },
  { role: "ADMIN" },
])(
  "invalid or server-owned contact input is rejected without echo: %j",
  async (invalid) => {
    const response = await submit({ ...payload(), ...invalid });
    expect(response.status).toBe(422);
    const error = (await response.json()) as ApiErrorDto;
    expect(error.error.code).toBe("VALIDATION_FAILED");
    expect(error.error.fields?.length).toBeGreaterThan(0);
    expect(Object.keys(error.error.fields![0]).sort()).toEqual([
      "code",
      "path",
    ]);
  },
);

test("Unicode names fit the same code-point cap as PostgreSQL", async () => {
  const response = await submit({ ...payload(), contactName: "🙂".repeat(80) });
  expect(response.status).toBe(201);
});

test("missing/invalid key and unknown query cannot create a request", async () => {
  expect((await submit(payload(), { key: null })).status).toBe(422);
  expect((await submit(payload(), { key: "invalid" })).status).toBe(422);
  expect(
    (await submit(payload(), { query: "?customerUserId=forged" })).status,
  ).toBe(422);
});

test("origin, JSON type, malformed and oversized bodies fail safely", async () => {
  expect((await submit(payload(), { origin: null })).status).toBe(403);
  expect(
    (await submit(payload(), { origin: "https://untrusted.example" })).status,
  ).toBe(403);
  expect((await submit(payload(), { contentType: "text/plain" })).status).toBe(
    415,
  );
  expect((await submit(payload(), { rawBody: "{" })).status).toBe(400);
  expect(
    (
      await submit(payload(), {
        rawBody: JSON.stringify({ padding: "a".repeat(120_000) }),
      })
    ).status,
  ).toBe(413);
});

test("same key/different body conflicts and does not mutate the original contact", async () => {
  const key = randomUUID();
  const input = payload();
  const first = await submit(input, { key });
  const receipt = (await first.json()) as ServiceRequestReceiptDto;
  const conflict = await submit(
    { ...input, contactName: "Another contact" },
    { key },
  );
  expect(conflict.status).toBe(409);
  expect(((await conflict.json()) as ApiErrorDto).error.code).toBe(
    "IDEMPOTENCY_KEY_REUSED",
  );
  expect(
    (
      await db.serviceRequest.findUniqueOrThrow({
        where: { id: receipt.requestId },
      })
    ).contactName,
  ).toBe(input.contactName);
});

test("two real app instances serialize replay and do not consume quota twice", async () => {
  const second = await createApplication();
  try {
    await second.listen(0, "127.0.0.1");
    vi.spyOn(second.get(RequestClock), "now").mockImplementation(
      () => new Date(now),
    );
    const key = randomUUID();
    const input = payload();
    const responses = await Promise.all([
      submit(input, { key }),
      submit(input, { key, base: await second.getUrl() }),
      submit(input, { key }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 200, 201,
    ]);
    const receipts = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(receipts[0]).toEqual(receipts[1]);
    expect(receipts[0]).toEqual(receipts[2]);
    expect(
      await db.serviceRequest.count({
        where: { creationKeyHash: assistanceKeyHash(key) },
      }),
    ).toBe(1);
    const rate = await db.serviceRequestRateLimit.findUniqueOrThrow({
      where: { key: requestRateKey(secret, "phone", input.phone) },
    });
    expect(rate.count).toBe(1);
  } finally {
    await second.close();
  }
});

test("phone cap is atomic and original receipt stays replayable after denial", async () => {
  const input = payload();
  const firstKey = randomUUID();
  const first = await submit(input, { key: firstKey });
  expect(first.status).toBe(201);
  const receipt = await first.json();
  const raced = await Promise.all([
    submit(input),
    submit(input),
    submit(input),
  ]);
  expect(raced.map((response) => response.status).sort()).toEqual([
    201, 201, 429,
  ]);
  const denied = raced.find((response) => response.status === 429)!;
  expect(Number(denied.headers.get("Retry-After"))).toBe(3600);
  const repeated = await submit(input, { key: firstKey });
  expect(repeated.status).toBe(200);
  expect(await repeated.json()).toEqual(receipt);
  expect(
    (
      await db.serviceRequestRateLimit.findUniqueOrThrow({
        where: { key: requestRateKey(secret, "phone", input.phone) },
      })
    ).count,
  ).toBe(4);
  now += 60 * 60_000 + 1;
  expect((await submit(input)).status).toBe(201);
});

test("IP cap ignores forged forwarding headers and resets after its server expiry", async () => {
  for (let index = 0; index < 10; index++) {
    expect(
      (
        await submit(payload(), {
          headers: { "X-Forwarded-For": `203.0.113.${index + 1}` },
        })
      ).status,
    ).toBe(201);
  }
  const denied = await submit(payload(), {
    headers: { "X-Forwarded-For": "198.51.100.1" },
  });
  expect(denied.status).toBe(429);
  expect(Number(denied.headers.get("Retry-After"))).toBe(900);
  now += 15 * 60_000 + 1;
  expect((await submit()).status).toBe(201);
});

test("technical rollback leaves neither request nor consumed rate counters", async () => {
  const input = payload();
  const key = randomUUID();
  const rateKey = requestRateKey(secret, "phone", input.phone);
  const rate = app.get(RequestRateService);
  const reserve = rate.reserve.bind(rate);
  vi.spyOn(rate, "reserve").mockImplementationOnce(async (...args) => {
    await reserve(...args);
    throw new Error("Synthetic failure after rate write");
  });
  const response = await submit(input, { key });
  expect(response.status).toBe(503);
  expect(
    await db.serviceRequest.findUnique({
      where: { creationKeyHash: assistanceKeyHash(key) },
    }),
  ).toBeNull();
  expect(
    await db.serviceRequestRateLimit.findUnique({ where: { key: rateKey } }),
  ).toBeNull();
});

test("a valid signed-in cookie does not silently attach an anonymous request", async () => {
  const user = await db.user.create({
    data: {
      email: `request-${randomUUID()}@example.test`,
      passwordHash: "synthetic-unused-hash",
      emailVerifiedAt: new Date(),
    },
  });
  users.push(user.id);
  const token = await db.$transaction((tx) =>
    app.get(SessionService).create(tx, user.id),
  );
  const response = await submit(payload(), {
    headers: {
      Cookie: `povod-session=${token}`,
      Authorization: "Bearer forged",
    },
  });
  expect(response.status).toBe(201);
  const receipt = (await response.json()) as ServiceRequestReceiptDto;
  const row = await db.serviceRequest.findUniqueOrThrow({
    where: { id: receipt.requestId },
  });
  expect(row.customerUserId).toBeNull();
  expect(row.projectId).toBeNull();
});

test("public GET/detail endpoints do not expose contacts", async () => {
  const response = await submit();
  const receipt = (await response.json()) as ServiceRequestReceiptDto;
  for (const path of ["", `/${receipt.requestId}`]) {
    const denied = await fetch(url + "/api/v1/service-requests" + path);
    expect(denied.status).toBe(404);
    expect(denied.headers.get("Cache-Control")).toBe("no-store");
  }
});

test("expired rate cleanup preserves live counters", async () => {
  const expiredPhone = nextPhone();
  const livePhone = nextPhone();
  phones.add(expiredPhone);
  phones.add(livePhone);
  const expiredKey = requestRateKey(secret, "phone", expiredPhone);
  const liveKey = requestRateKey(secret, "phone", livePhone);
  await db.serviceRequestRateLimit.createMany({
    data: [
      { key: expiredKey, count: 1, expiresAt: new Date(now - 1) },
      { key: liveKey, count: 1, expiresAt: new Date(now + 60_000) },
    ],
  });
  await app.get(RequestRateService).cleanup();
  expect(
    await db.serviceRequestRateLimit.findUnique({ where: { key: expiredKey } }),
  ).toBeNull();
  expect(
    await db.serviceRequestRateLimit.findUnique({ where: { key: liveKey } }),
  ).not.toBeNull();
});

test("missing production request secret disables new submissions without disabling liveness", async () => {
  const previousMode = process.env.NODE_ENV;
  const previousSecret = process.env.SERVICE_REQUEST_RATE_SECRET;
  let isolated: INestApplication | undefined;
  try {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SERVICE_REQUEST_RATE_SECRET", undefined);
    isolated = await createApplication();
    await isolated.listen(0, "127.0.0.1");
    const origin = await isolated.getUrl();
    const key = randomUUID();
    const response = await submit(payload(), { key, base: origin });
    expect(response.status).toBe(503);
    expect(
      await db.serviceRequest.findUnique({
        where: { creationKeyHash: assistanceKeyHash(key) },
      }),
    ).toBeNull();
    expect((await fetch(origin + "/health")).status).toBe(200);
  } finally {
    await isolated?.close();
    vi.stubEnv("NODE_ENV", previousMode);
    vi.stubEnv("SERVICE_REQUEST_RATE_SECRET", previousSecret);
  }
});

test("secret validation fails closed and never treats odd hex as complete bytes", () => {
  const previousMode = process.env.NODE_ENV;
  const previousSecret = process.env.SERVICE_REQUEST_RATE_SECRET;
  try {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SERVICE_REQUEST_RATE_SECRET", undefined);
    expect(() => requestRateSecret()).toThrow("required in production");
    vi.stubEnv("SERVICE_REQUEST_RATE_SECRET", "a".repeat(65));
    expect(() => requestRateSecret()).toThrow("32 random bytes");
  } finally {
    vi.stubEnv("NODE_ENV", previousMode);
    vi.stubEnv("SERVICE_REQUEST_RATE_SECRET", previousSecret);
  }
});

test("OpenAPI has no cookie authorization and returns only the receipt contract", () => {
  const doc = createOpenApiDocument(app);
  const operation = doc.paths["/api/v1/service-requests"]?.post;
  expect(operation?.security).toBeUndefined();
  expect(operation?.operationId).toBe("createServiceRequest");
  expect(Object.keys(operation?.responses ?? {})).toEqual(
    expect.arrayContaining(["200", "201", "403", "409", "422", "429", "503"]),
  );
  expect(doc.components?.schemas).toHaveProperty("ServiceRequestReceiptDto");
});
