import "reflect-metadata";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createRequire } from "node:module";
import {
  Body,
  Controller,
  Module,
  Post,
  type INestApplication,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { GardenDraftDto as Draft } from "./garden-content.dto.js";
import type { ApiErrorDto } from "../../../http/api-error.js";

const require = createRequire(import.meta.url);
const {
  GardenDraftDto,
}: typeof import("./garden-content.dto.js") = require("../../../../dist/modules/templates/garden/garden-content.dto.js");
const {
  validateGardenDraft,
  validateGardenComplete,
}: typeof import("./validate-garden.js") = require("../../../../dist/modules/templates/garden/validate-garden.js");
const {
  createValidationPipe,
}: typeof import("../../../http/validation-pipe.js") = require("../../../../dist/http/validation-pipe.js");
const {
  ApiExceptionFilter,
}: typeof import("../../../http/api-exception.filter.js") = require("../../../../dist/http/api-exception.filter.js");

function fixture(): Draft {
  return {
    templateVersionId: "wedding-garden-v1",
    title: "Наш день",
    content: {
      locale: "ru",
      themeId: "sage",
      copy: {
        invitationLabel: "Встречаемся",
        namesConnector: "и",
        introduction: "Привет, {guest}!\nЖдём вас.",
        detailsTitle: "Детали",
        whenLabel: "Когда",
        whereLabel: "Где",
        startTimeLabel: "Начало",
        timeZoneLabel: "Часовой пояс",
        routeLabel: "Маршрут",
        programEyebrow: "Наш день",
        programTitle: "Программа",
        rsvpEyebrow: "Ответ",
        rsvpTitle: "Вы придёте?",
        footerText: "До встречи",
      },
      names: { first: "Анна", second: "Михаил" },
      event: {
        localDate: "2024-02-29",
        localTime: "16:00",
        timeZone: "Europe/Samara",
      },
      venue: { name: "Тихий сад", address: "Самара", routeUrl: null },
      program: [{ time: "16:00", text: "Сбор гостей" }],
      heroMediaId: null,
    },
  };
}

type JsonRecord = { [key: string]: unknown };
function change(draft: Draft, path: string, value: unknown): JsonRecord {
  const root: JsonRecord = JSON.parse(JSON.stringify(draft));
  const keys = path.split(".");
  let parent: JsonRecord = root;
  for (const key of keys.slice(0, -1)) parent = parent[key] as JsonRecord;
  Object.defineProperty(parent, keys[keys.length - 1], {
    value,
    enumerable: true,
    configurable: true,
  });
  return root;
}

// Test-only HTTP fixture: no validation endpoint is added to the product API.
class ValidationController {
  draft(body: Draft) {
    return validateGardenDraft(body);
  }
  complete(body: Draft) {
    return validateGardenComplete(body);
  }
}
Controller("validation")(ValidationController);
for (const method of ["draft", "complete"] as const) {
  Reflect.defineMetadata(
    "design:paramtypes",
    [GardenDraftDto],
    ValidationController.prototype,
    method,
  );
  Post(method)(
    ValidationController.prototype,
    method,
    Object.getOwnPropertyDescriptor(ValidationController.prototype, method)!,
  );
  Body()(ValidationController.prototype, method, 0);
}
class ValidationModule {}
Module({ controllers: [ValidationController] })(ValidationModule);
let app: INestApplication;
let origin: string;
beforeAll(async () => {
  app = await NestFactory.create(ValidationModule, { logger: false });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
});
afterAll(async () => {
  await app?.close();
});

async function send(body: unknown, mode = "draft") {
  return fetch(`${origin}/validation/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("complete content preserves all owner text, past date, null blocks and input object", async () => {
  const input = fixture();
  input.content.copy.invitationLabel = "";
  input.content.copy.introduction = "  <b>{guest}</b>\n Hello 👩‍🚀  ";
  input.content.locale = "en";
  input.content.themeId = "sand";
  input.content.program = null;
  const before = structuredClone(input);
  const response = await send(input, "complete");
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(input);
  expect(validateGardenComplete(input)).toEqual(input);
  expect(input).toEqual(before);
});

test("draft allows blank required values and incomplete enabled program; completeness reports exact required paths", async () => {
  const input = fixture();
  input.title = "";
  input.content.names.first = "  ";
  input.content.event = { localDate: "", localTime: "", timeZone: "" };
  input.content.venue = { name: "", address: "", routeUrl: "" };
  input.content.program = [{ time: "", text: "" }];
  expect((await send(input)).status).toBe(201);
  const response = await send(input, "complete");
  expect(response.status).toBe(422);
  const body = (await response.json()) as ApiErrorDto;
  expect(body.error.fields).toContainEqual({
    path: "content.names.first",
    code: "REQUIRED",
  });
  expect(body.error.fields).toContainEqual({
    path: "content.program.0.text",
    code: "REQUIRED",
  });
  input.content.program = [];
  expect((await send(input)).status).toBe(201);
  expect(() => validateGardenComplete(input)).toThrow();
});

test.each([
  ["title", 24],
  ["content.names.first", 20],
  ["content.names.second", 20],
  ["content.venue.name", 80],
  ["content.venue.address", 150],
  ["content.copy.invitationLabel", 80],
  ["content.copy.namesConnector", 16],
  ["content.copy.introduction", 4000],
  ["content.copy.detailsTitle", 160],
  ["content.copy.whenLabel", 80],
  ["content.copy.whereLabel", 80],
  ["content.copy.startTimeLabel", 80],
  ["content.copy.timeZoneLabel", 80],
  ["content.copy.routeLabel", 80],
  ["content.copy.programEyebrow", 80],
  ["content.copy.programTitle", 160],
  ["content.copy.rsvpEyebrow", 80],
  ["content.copy.rsvpTitle", 160],
  ["content.copy.footerText", 1000],
  ["content.program.0.text", 200],
] as const)(
  "enforces the agreed Unicode boundary for %s",
  async (path, max) => {
    const valid = change(fixture(), path, "😀".repeat(max));
    expect((await send(valid)).status).toBe(201);
    const invalid = change(fixture(), path, "😀".repeat(max + 1));
    const response = await send(invalid);
    expect(response.status).toBe(422);
    expect(
      ((await response.json()) as ApiErrorDto).error.fields,
    ).toContainEqual({
      path,
      code: "INVALID_VALUE",
    });
    expect(() => validateGardenDraft(invalid)).toThrow();
  },
);

test.each([
  ["content.names.ownerId", "private-value", "UNKNOWN_FIELD"],
  ["content.names.__proto__", { polluted: true }, "UNKNOWN_FIELD"],
  ["content.copy.constructor", { polluted: true }, "UNKNOWN_FIELD"],
  ["content.program.0.ownerId", "private-value", "UNKNOWN_FIELD"],
  ["content.copy.secret", "private-value", "UNKNOWN_FIELD"],
  ["ownerId", "private-value", "UNKNOWN_FIELD"],
  ["content.names.first", 123, "INVALID_VALUE"],
  ["content.names", null, "INVALID_VALUE"],
  ["content.copy", [], "INVALID_VALUE"],
  ["content.locale", "de", "INVALID_VALUE"],
  ["content.themeId", "black", "INVALID_VALUE"],
  ["templateVersionId", "wedding-garden-v2", "INVALID_VALUE"],
  ["content.event.localDate", "2025-02-29", "INVALID_VALUE"],
  ["content.event.localDate", "2024-04-31", "INVALID_VALUE"],
  ["content.event.localTime", "24:00", "INVALID_VALUE"],
  ["content.event.timeZone", "+03:00", "INVALID_VALUE"],
  ["content.event.timeZone", "Mars/Base", "INVALID_VALUE"],
  ["content.venue.routeUrl", "http://example.test", "INVALID_VALUE"],
  ["content.venue.routeUrl", "https://user:pass@example.test", "INVALID_VALUE"],
  ["content.venue.routeUrl", "https://example.test/\\hidden", "INVALID_VALUE"],
  ["content.venue.routeUrl", "https://example.test/\nvalue", "INVALID_VALUE"],
  ["content.heroMediaId", "https://example.test/photo.jpg", "INVALID_VALUE"],
  ["content.heroMediaId", "", "INVALID_VALUE"],
  ["content.program", {}, "INVALID_VALUE"],
] as const)(
  "rejects invalid %s without echoing the input",
  async (path, value, code) => {
    const input = change(fixture(), path, value);
    const response = await send(input);
    expect(response.status).toBe(422);
    const body = (await response.json()) as ApiErrorDto;
    expect(body.error.fields).toContainEqual({ path, code });
    expect(body.error.requestId).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain("private-value");
    expect(() => validateGardenDraft(input)).toThrow();
  },
);

test("required nullable properties cannot be omitted; root/object/array shapes stay strict", async () => {
  for (const path of [
    "content",
    "content.venue.routeUrl",
    "content.program",
    "content.heroMediaId",
    "content.copy.namesConnector",
  ]) {
    const input = change(fixture(), path, undefined);
    expect((await send(input)).status).toBe(422);
    expect(() => validateGardenDraft(input)).toThrow();
  }
  for (const input of [null, [], "value", { content: null }])
    expect(() => validateGardenDraft(input)).toThrow();
  const badItem = change(fixture(), "content.program", [null]);
  expect((await send(badItem)).status).toBe(422);
});

test("program cap and HTTPS link cap are enforced, media references do not claim ready/owner", async () => {
  const input = fixture();
  input.content.program = Array.from({ length: 12 }, () => ({
    time: "16:00",
    text: "Встреча",
  }));
  input.content.venue.routeUrl = `https://example.test/${"a".repeat(179)}`;
  expect(input.content.venue.routeUrl).toHaveLength(200);
  input.content.heroMediaId = "7cc0dca7-1080-4fb3-a37c-89c9f7c07953";
  expect((await send(input, "complete")).status).toBe(201);
  input.content.venue.routeUrl += "a";
  expect((await send(input)).status).toBe(422);
  input.content.venue.routeUrl = null;
  input.content.program.push({ time: "16:00", text: "Ещё" });
  expect((await send(input)).status).toBe(422);
});

test("malformed JSON is 400, not a successful draft", async () => {
  const response = await fetch(`${origin}/validation/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"content":',
  });
  expect(response.status).toBe(400);
});
