import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import type { INestApplication } from "@nestjs/common";
import type { TemplateCatalogDto } from "./template-catalog.dto.js";

const require = createRequire(import.meta.url);
const {
  createApplication,
  createOpenApiDocument,
}: typeof import("../../create-application.js") = require("../../../dist/create-application.js");
let app: INestApplication;
let origin: string;
beforeAll(async () => {
  // This worker must prove that the catalog is independent of identity/DB, not use the integration DB by accident.
  vi.stubEnv("DATABASE_URL", undefined);
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
});
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});

test("anonymous catalog works without a database and returns only public metadata", async () => {
  const response = await fetch(`${origin}/api/v1/templates`);
  const body = (await response.json()) as TemplateCatalogDto;
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(body.items).toHaveLength(1);
  expect(Object.keys(body.items[0]).sort()).toEqual([
    "blocks",
    "demoPath",
    "eventType",
    "previewImagePath",
    "schemaVersion",
    "templateVersionId",
    "themes",
    "title",
  ]);
  expect(body.items[0].templateVersionId).toBe("wedding-garden-v1");
  expect(body.items[0].themes.map((theme) => theme.id)).toEqual([
    "sage",
    "sand",
  ]);
  expect(body.items[0].blocks.map((block) => block.id)).toEqual([
    "names",
    "event",
    "venue",
    "photo",
    "program",
    "rsvp",
  ]);
  expect(
    body.items[0].blocks.find((block) => block.id === "rsvp")?.required,
  ).toBe(true);
  for (const field of [
    "ownerId",
    "passwordHash",
    "email",
    "privateKey",
    "firstPublishedAt",
  ])
    expect(JSON.stringify(body)).not.toContain(field);
});
test("locale changes catalog labels without changing template version or block order", async () => {
  const ru = (await (
    await fetch(`${origin}/api/v1/templates?locale=ru`)
  ).json()) as TemplateCatalogDto;
  const en = (await (
    await fetch(`${origin}/api/v1/templates?locale=en`)
  ).json()) as TemplateCatalogDto;
  expect(en.items[0].title).toBe("Quiet Garden");
  expect(ru.items[0].title).toBe("Тихий сад");
  expect(en.items[0].templateVersionId).toBe(ru.items[0].templateVersionId);
  expect(en.items[0].blocks).toEqual(ru.items[0].blocks);
});
test.each(["locale=de", "locale=ru&locale=en", "ownerId=somebody", "limit=4"])(
  "invalid query is rejected: %s",
  async (query) => {
    expect((await fetch(`${origin}/api/v1/templates?${query}`)).status).toBe(
      422,
    );
  },
);
test("the endpoint has no mutation or account side effect", async () => {
  expect(
    (
      await fetch(`${origin}/api/v1/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
  ).toBe(404);
  expect((await fetch(`${origin}/api/v1/auth/session`)).status).toBe(401);
});
test("OpenAPI describes the public operation and typed nested metadata", () => {
  const document = createOpenApiDocument(app);
  const operation = document.paths["/api/v1/templates"]?.get;
  expect(operation?.operationId).toBe("getTemplateCatalog");
  expect(operation?.security).toBeUndefined();
  expect(document.components?.schemas).toHaveProperty("TemplateCatalogDto");
  expect(document.components?.schemas).toHaveProperty("TemplateSummaryDto");
});

test("OpenAPI exports the actual garden DTO constraints without adding a write endpoint", () => {
  const document = createOpenApiDocument(app);
  const schemas = document.components?.schemas;
  expect(document.info.version).toBe("0.8.0");
  expect(schemas?.GardenDraftDto).toMatchObject({
    required: expect.arrayContaining(["title", "templateVersionId", "content"]),
    properties: { title: { type: "string", maxLength: 24 } },
  });
  expect(schemas?.GardenNamesDto).toMatchObject({
    properties: { first: { maxLength: 20 }, second: { maxLength: 20 } },
  });
  expect(schemas?.GardenVenueDto).toMatchObject({
    required: expect.arrayContaining(["name", "address", "routeUrl"]),
    properties: {
      name: { maxLength: 80 },
      address: { maxLength: 150 },
      routeUrl: { maxLength: 200, nullable: true },
    },
  });
  expect(schemas?.GardenContentDto).toMatchObject({
    properties: {
      program: { maxItems: 12, nullable: true },
      heroMediaId: { format: "uuid", nullable: true },
    },
  });
  expect(document.paths["/api/v1/projects"]).toBeUndefined();
  expect(document.paths["/api/v1/templates"]?.post).toBeUndefined();
});
