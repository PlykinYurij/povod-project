import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type {
  Template,
  TemplateVersion,
  TemplateCategory,
} from "../../database/generated/client.js";
import type { TemplateCatalogDto } from "./template-catalog.dto.js";
import type { ProjectDto } from "../projects/project.dto.js";
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
  TemplateCatalogService,
}: typeof import("./template-catalog.service.js") = require("../../../dist/modules/templates/template-catalog.service.js");
const userIds: string[] = [];
const extraVersions: string[] = [];
let app: INestApplication;
let db: ReturnType<typeof createDatabaseClient>;
let url: string;
let initialTemplate: Template;
let initialVersion: TemplateVersion;
let initialCategory: TemplateCategory;

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  vi.stubEnv("WEB_ORIGIN", TEST_ORIGIN);
  db = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  initialTemplate = await db.template.findUniqueOrThrow({
    where: { id: "quiet-garden" },
  });
  initialVersion = await db.templateVersion.findUniqueOrThrow({
    where: { id: "wedding-garden-v1" },
  });
  initialCategory = await db.templateCategory.findUniqueOrThrow({
    where: { id: "wedding" },
  });
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
});

afterEach(async () => {
  // Shared code-owned catalog fixtures are restored only in the isolated test DB.
  if (!db || !initialTemplate) return;
  await db.templateVersion.deleteMany({ where: { id: { in: extraVersions } } });
  await db.templateVersion.update({
    where: { id: initialVersion.id },
    data: initialVersion,
  });
  await db.template.update({
    where: { id: initialTemplate.id },
    data: initialTemplate,
  });
  await db.templateCategory.update({
    where: { id: initialCategory.id },
    data: initialCategory,
  });
});

afterAll(async () => {
  await app?.close();
  if (db) {
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
  vi.unstubAllEnvs();
});

async function catalog(query = ""): Promise<TemplateCatalogDto> {
  const response = await fetch(url + "/api/v1/templates" + query);
  expect(response.status).toBe(200);
  return (await response.json()) as TemplateCatalogDto;
}

async function owner() {
  const user = await db.user.create({
    data: {
      email: `catalog-${randomUUID()}@example.test`,
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

async function create(
  cookie: string,
  key = randomUUID(),
  templateVersionId = "wedding-garden-v1",
) {
  return fetch(url + "/api/v1/projects", {
    method: "POST",
    headers: {
      ...(await csrfHeaders(url, cookie)),
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({ templateVersionId, title: "Catalog fixture" }),
  });
}

test("categories are localized and filtering does not promise unimplemented designs", async () => {
  const ru = await catalog("?locale=ru&category=wedding");
  const en = await catalog("?category=wedding&locale=en");
  expect(
    ru.categories.find((category) => category.id === "wedding")?.title,
  ).toBe("Свадьба");
  expect(
    en.categories.find((category) => category.id === "wedding")?.title,
  ).toBe("Wedding");
  expect(ru.items).toHaveLength(1);
  expect(ru.items[0]).toMatchObject({
    templateId: "quiet-garden",
    categoryId: "wedding",
    templateVersionId: "wedding-garden-v1",
    schemaVersion: 1,
  });
  expect((await catalog("?category=birthday")).items).toEqual([]);
  expect((await catalog("?category=unknown-category")).items).toEqual([]);
});

test.each([
  "category=",
  "category=UPPER",
  "category=../private",
  "category=wedding&category=birthday",
  "category=" + "a".repeat(65),
])("invalid category query is rejected: %s", async (query) => {
  expect((await fetch(url + "/api/v1/templates?" + query)).status).toBe(422);
});

test("price is either explicitly unconfigured or integer RUB with its version", async () => {
  await db.template.update({
    where: { id: "quiet-garden" },
    data: { priceMinor: null },
  });
  expect((await catalog()).items[0].price).toBeNull();
  await db.template.update({
    where: { id: "quiet-garden" },
    data: { priceMinor: 123456, priceVersion: { increment: 1 } },
  });
  expect((await catalog()).items[0].price).toEqual({
    amountMinor: 123456,
    currency: "RUB",
    version: initialTemplate.priceVersion + 1,
  });
});

test.each(["template", "version", "category"])(
  "hiding %s blocks new drafts but preserves replay and existing draft saves",
  async (hidden) => {
    const user = await owner();
    const key = randomUUID();
    const response = await create(user.cookie, key);
    expect(response.status).toBe(201);
    const project = (await response.json()) as ProjectDto;
    if (hidden === "template")
      await db.template.update({
        where: { id: "quiet-garden" },
        data: { active: false },
      });
    if (hidden === "version")
      await db.templateVersion.update({
        where: { id: "wedding-garden-v1" },
        data: { availableForNewProjects: false },
      });
    if (hidden === "category")
      await db.templateCategory.update({
        where: { id: "wedding" },
        data: { active: false },
      });
    expect((await catalog()).items).toEqual([]);
    expect((await create(user.cookie)).status).toBe(404);
    const replay = await create(user.cookie, key);
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as ProjectDto).id).toBe(project.id);
    const saved = await fetch(`${url}/api/v1/projects/${project.id}/draft`, {
      method: "PATCH",
      headers: {
        ...(await csrfHeaders(url, user.cookie)),
        Origin: TEST_ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedRevision: project.revision,
        title: project.title,
        content: project.content,
      }),
    });
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as ProjectDto).revision).toBe(
      project.revision + 1,
    );
  },
);

test("a DB row cannot enable an unknown renderer or schema", async () => {
  const user = await owner();
  await db.templateVersion.update({
    where: { id: "wedding-garden-v1" },
    data: { rendererKey: "unshipped-renderer" },
  });
  expect((await catalog()).items).toEqual([]);
  expect((await create(user.cookie)).status).toBe(404);
});

test("SQL constraints reject negative price and two available versions", async () => {
  await expect(
    db.template.update({
      where: { id: "quiet-garden" },
      data: { priceMinor: -1 },
    }),
  ).rejects.toThrow();
  const id = `test-catalog-${randomUUID()}`;
  extraVersions.push(id);
  await expect(
    db.templateVersion.create({
      data: {
        id,
        templateId: "quiet-garden",
        schemaVersion: 2,
        rendererKey: "garden-v2",
        defaultsVersion: 1,
        availableForNewProjects: true,
      },
    }),
  ).rejects.toThrow();
  await db.templateVersion.create({
    data: {
      id,
      templateId: "quiet-garden",
      schemaVersion: 2,
      rendererKey: "garden-v2",
      defaultsVersion: 1,
    },
  });
  expect((await catalog()).items).toHaveLength(1);
});

test("project FK refuses an unknown version and keeps saved JSONB intact", async () => {
  const user = await owner();
  const created = await create(user.cookie);
  const project = (await created.json()) as ProjectDto;
  await expect(
    db.project.update({
      where: { id: project.id },
      data: { templateVersionId: `missing-${randomUUID()}` },
    }),
  ).rejects.toThrow();
  const stored = await db.project.findUniqueOrThrow({
    where: { id: project.id },
  });
  expect(stored.templateVersionId).toBe("wedding-garden-v1");
  expect(stored.content).toEqual(project.content);
  expect(stored.revision).toBe(project.revision);
});

test("availability rows remain locked through the creation transaction", async () => {
  let release!: () => void;
  let acquired!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = new Promise<void>((resolve) => {
    acquired = resolve;
  });
  const transaction = db.$transaction(async (tx) => {
    await app
      .get(TemplateCatalogService)
      .assertAvailableForCreation(tx, "wedding-garden-v1");
    acquired();
    await gate;
  });
  await held;
  try {
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '200ms'`;
        await tx.template.update({
          where: { id: "quiet-garden" },
          data: { active: false },
        });
      }),
    ).rejects.toThrow();
  } finally {
    release();
    await transaction;
  }
  const updated = await db.template.update({
    where: { id: "quiet-garden" },
    data: { active: false },
  });
  expect(updated.active).toBe(false);
});

test("missing database fails closed for catalog while liveness remains available", async () => {
  const previous = process.env.DATABASE_URL;
  vi.stubEnv("DATABASE_URL", undefined);
  const isolated = await createApplication();
  try {
    await isolated.listen(0, "127.0.0.1");
    const origin = await isolated.getUrl();
    const unavailable = await fetch(origin + "/api/v1/templates");
    expect(unavailable.status).toBe(503);
    expect((await fetch(origin + "/health")).status).toBe(200);
  } finally {
    await isolated.close();
    vi.stubEnv("DATABASE_URL", previous);
  }
});

test("OpenAPI exports categories, nullable price and public filter without role assignment", () => {
  const doc = createOpenApiDocument(app);
  expect(doc.info.version).toBe("0.11.0");
  const operation = doc.paths["/api/v1/templates"]?.get;
  expect(operation?.security).toBeUndefined();
  expect(operation?.parameters).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: "category" })]),
  );
  expect(doc.components?.schemas).toHaveProperty("TemplatePriceDto");
  expect(doc.components?.schemas).toHaveProperty("TemplateCategoryDto");
});
