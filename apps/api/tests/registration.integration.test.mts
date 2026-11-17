import { beforeAll, afterAll, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { verifyDatabaseTarget } from "../../../scripts/database-safety.mjs";
import type { INestApplication } from "@nestjs/common";
import type { RegisterResponseDto } from "../src/modules/identity/register.dto.js";
import type { ApiErrorDto } from "../src/http/api-error.js";

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
  fetch(`${url}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      ...(origin ? { Origin: origin } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  database = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  process.env.REGISTER_RATE_LIMIT = "100"; // fixture; separate test covers throttling
  app = await createApplication();
  enableOpenApi(app);
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
});
afterAll(async () => {
  if (database) {
    await database.user.deleteMany({ where: { email: { in: emails } } });
    await database.$disconnect();
  }
  await app?.close();
});

test("creates a safe owner DTO, normalizes email without losing dots/plus, hashes and salts password", async () => {
  const address = email();
  const response = await request({
    email: `  ${address.toUpperCase()}  `,
    password,
  });
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  const body = await json<RegisterResponseDto>(response);
  expect(Object.keys(body.user).sort()).toEqual(["email", "id"]);
  expect(body.user.email).toBe(address);
  const stored = await database.user.findUniqueOrThrow({
    where: { email: address },
  });
  expect(stored.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(await verifyPassword(stored.passwordHash, password)).toBe(true);
  expect(await verifyPassword(stored.passwordHash, `${password} `)).toBe(false);
  const second = email();
  expect((await request({ email: second, password })).status).toBe(201);
  const other = await database.user.findUniqueOrThrow({
    where: { email: second },
  });
  expect(stored.passwordHash).not.toBe(other.passwordHash);
});

test("concurrent case-insensitive duplicate creates one account with one 409", async () => {
  const address = email();
  const results = await Promise.all([
    request({ email: address, password }),
    request({ email: address.toUpperCase(), password }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  const conflict = results.find((r) => r.status === 409)!;
  expect((await json<ApiErrorDto>(conflict)).error.code).toBe(
    "EMAIL_UNAVAILABLE",
  );
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
    expect((await request({ email: address, password: valid })).status).toBe(
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
  for (const status of [201, 400, 403, 409, 413, 415, 422, 429, 503])
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

test("trusted CORS preflight works and production registration stays closed without explicit limit", async () => {
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
      `${await production.getUrl()}/api/v1/auth/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({ email: email(), password }),
      },
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
