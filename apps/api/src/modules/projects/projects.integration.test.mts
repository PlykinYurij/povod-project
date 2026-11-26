import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { GardenContentDto } from "../templates/garden/garden-content.dto.js";
import type {
  ProjectDto as VersionedProjectDto,
  ProjectListDto,
} from "./project.dto.js";
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
  hashPassword,
}: typeof import("../identity/password.js") = require("../../../dist/modules/identity/password.js");
const userIds: string[] = [];
const {
  GardenTemplateService,
}: typeof import("../templates/garden/garden-template.service.js") = require("../../../dist/modules/templates/garden/garden-template.service.js");
let app: INestApplication;
let url: string;
let db: ReturnType<typeof createDatabaseClient>;
let passwordHash: string;

beforeAll(async () => {
  await verifyDatabaseTarget(
    process.env.POVOD_TEST_DATABASE_URL,
    "test",
    process.env.POVOD_TEST_DATABASE,
  );
  vi.stubEnv("WEB_ORIGIN", TEST_ORIGIN);
  db = createDatabaseClient(process.env.POVOD_TEST_DATABASE_URL!);
  passwordHash = await hashPassword("SyntheticDraft1!");
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  url = await app.getUrl();
});
afterAll(async () => {
  await app?.close();
  if (db) {
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
  vi.unstubAllEnvs();
});

async function owner() {
  const user = await db.user.create({
    data: {
      email: `draft-${randomUUID()}@example.test`,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  userIds.push(user.id);
  const token = await db.$transaction((tx) =>
    app.get(SessionService).create(tx, user.id),
  );
  return { id: user.id, cookie: `povod-session=${token}` };
}
type Owner = Awaited<ReturnType<typeof owner>>;
async function mutate(
  actor: Owner,
  path: string,
  body: unknown,
  method = "POST",
  key: string | undefined = randomUUID(),
  origin = url,
) {
  const csrf = await csrfHeaders(origin, actor.cookie);
  return fetch(`${origin}/api/v1/projects${path}`, {
    method,
    headers: {
      ...csrf,
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}
const initial = (title = "Наш день") => ({
  templateVersionId: "wedding-garden-v1",
  title,
});
async function create(actor: Owner, title = "Наш день") {
  const response = await mutate(actor, "", initial(title));
  expect(response.status).toBe(201);
  return (await response.json()) as ProjectDto;
}
function get(actor: Owner, path: string) {
  return fetch(`${url}/api/v1/projects${path}`, {
    headers: { Cookie: actor.cookie },
  });
}
type ProjectDto = VersionedProjectDto & { content: GardenContentDto };

test("Together draft uses the stored version to validate edits and isolate owners", async () => {
  const version = "wedding-together-v1";
  const original = await db.templateVersion.findUniqueOrThrow({
    where: { id: version },
  });
  await db.templateVersion.update({
    where: { id: version },
    data: { availableForNewProjects: true },
  });
  try {
    const [actor, other] = await Promise.all([owner(), owner()]);
    const key = randomUUID();
    const request = { templateVersionId: version, title: "Наш день" };
    const created = await mutate(actor, "", request, "POST", key);
    expect(created.status).toBe(201);
    const project = (await created.json()) as VersionedProjectDto;
    expect(project.templateVersionId).toBe(version);
    expect(project.content).toMatchObject({ photo: { mediaId: null } });
    const replay = await mutate(actor, "", request, "POST", key);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(project);
    const draftPath = `/${project.id}/draft`;
    const patch = {
      expectedRevision: project.revision,
      title: "Другой день",
      content: project.content,
    };
    expect((await mutate(other, draftPath, patch, "PATCH")).status).toBe(404);
    expect(
      (
        await mutate(
          actor,
          draftPath,
          {
            ...patch,
            content: new GardenTemplateService().createDraft(
              "wedding-garden-v1",
              "",
            ).content,
          },
          "PATCH",
        )
      ).status,
    ).toBe(422);
    const saved = await mutate(actor, draftPath, patch, "PATCH");
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      templateVersionId: version,
      revision: 2,
      title: patch.title,
      content: project.content,
    });
  } finally {
    await db.templateVersion.update({
      where: { id: version },
      data: { availableForNewProjects: original.availableForNewProjects },
    });
  }
});

function saveInput(project: ProjectDto, title = "Изменено") {
  return {
    expectedRevision: project.revision,
    title,
    content: structuredClone(project.content),
  };
}
async function error(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = (await response.json()) as ApiErrorDto;
  expect(body.error.code).toBe(code);
  expect(body.error.requestId).toEqual(expect.any(String));
  return body.error;
}

test("an authenticated owner creates, reads, lists and saves an incomplete draft with editable copy", async () => {
  const actor = await owner();
  const project = await create(actor, "");
  expect(project.revision).toBe(1);
  expect(project.canEditDraft).toBe(true);
  expect(project.firstPublishedAt).toBeNull();
  expect(project.content.names.first).toBe("");
  expect(project.content.heroMediaId).toBeNull();
  expect(project.content.copy.introduction).toContain("Приглашаем");
  const input = saveInput(project, "Юлия и Андрей");
  input.content.locale = "en";
  input.content.copy.namesConnector = "";
  input.content.copy.introduction = "  <b>{guest}</b>\nДо встречи 😀  ";
  input.content.program = [{ time: "", text: "" }];
  const savedResponse = await mutate(
    actor,
    `/${project.id}/draft`,
    input,
    "PATCH",
  );
  expect(savedResponse.status).toBe(200);
  const saved = (await savedResponse.json()) as ProjectDto;
  expect(saved.revision).toBe(2);
  expect(saved.content).toEqual(input.content);
  const read = await get(actor, `/${project.id}`);
  expect(read.headers.get("cache-control")).toBe("no-store");
  expect(await read.json()).toEqual(saved);
  const list = (await (await get(actor, "")).json()) as ProjectListDto;
  expect(list.items.map((item) => item.id)).toEqual([project.id]);
  expect(list.items[0]).not.toHaveProperty("content");
  for (const key of [
    "ownerId",
    "creationKeyHash",
    "creationPayloadHash",
    "email",
    "passwordHash",
  ])
    expect(saved).not.toHaveProperty(key);
});

test("guest cannot list/read/create/save; mutations require origin, JSON and CSRF", async () => {
  const actor = await owner();
  const project = await create(actor);
  for (const path of ["", `/${project.id}`])
    await error(
      await fetch(`${url}/api/v1/projects${path}`),
      401,
      "AUTH_REQUIRED",
    );
  for (const [path, method, body] of [
    ["", "POST", initial()],
    [`/${project.id}/draft`, "PATCH", saveInput(project)],
  ] as const) {
    await error(
      await fetch(`${url}/api/v1/projects${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      401,
      "AUTH_REQUIRED",
    );
    await error(
      await fetch(`${url}/api/v1/projects${path}`, {
        method,
        headers: {
          Cookie: actor.cookie,
          "Content-Type": "application/json",
          Origin: TEST_ORIGIN,
        },
        body: JSON.stringify(body),
      }),
      403,
      "CSRF_FAILED",
    );
    const csrf = await csrfHeaders(url, actor.cookie);
    await error(
      await fetch(`${url}/api/v1/projects${path}`, {
        method,
        headers: {
          ...csrf,
          "Content-Type": "application/json",
          Origin: "https://other.example.test",
        },
        body: JSON.stringify(body),
      }),
      403,
      "CSRF_FAILED",
    );
    await error(
      await fetch(`${url}/api/v1/projects${path}`, {
        method,
        headers: { ...csrf, "Content-Type": "text/plain", Origin: TEST_ORIGIN },
        body: JSON.stringify(body),
      }),
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  }
  expect(await db.project.count({ where: { ownerId: actor.id } })).toBe(1);
});

test("two owners cannot read/change each other's project or select ownerId through query/body", async () => {
  const a = await owner();
  const b = await owner();
  const project = await create(a);
  await create(b);
  for (const id of [project.id, randomUUID()]) {
    await error(await get(b, `/${id}`), 404, "PROJECT_NOT_FOUND");
    await error(
      await mutate(b, `/${id}/draft`, saveInput(project), "PATCH"),
      404,
      "PROJECT_NOT_FOUND",
    );
  }
  const list = (await (await get(b, "")).json()) as ProjectListDto;
  expect(list.items.map((item) => item.id)).not.toContain(project.id);
  await error(await get(b, `?ownerId=${a.id}`), 422, "VALIDATION_FAILED");
  await error(
    await mutate(b, `?ownerId=${a.id}`, initial()),
    422,
    "VALIDATION_FAILED",
  );
  await error(
    await mutate(
      b,
      `/${project.id}/draft?ownerId=${a.id}`,
      saveInput(project),
      "PATCH",
    ),
    422,
    "VALIDATION_FAILED",
  );
  await error(
    await mutate(b, "", { ...initial(), ownerId: a.id }),
    422,
    "VALIDATION_FAILED",
  );
  expect((await (await get(a, `/${project.id}`)).json()) as ProjectDto).toEqual(
    project,
  );
});

test("same create key/body survives retry and replay after edits without resetting revision or consuming quota", async () => {
  const actor = await owner();
  const key = randomUUID();
  const response = await mutate(actor, "", initial(), "POST", key);
  expect(response.status).toBe(201);
  const project = (await response.json()) as ProjectDto;
  const saved = (await (
    await mutate(actor, `/${project.id}/draft`, saveInput(project), "PATCH")
  ).json()) as ProjectDto;
  const replay = await mutate(actor, "", initial(), "POST", key.toUpperCase());
  expect(replay.status).toBe(200);
  expect(await replay.json()).toEqual(saved);
  await error(
    await mutate(actor, "", initial("Другое"), "POST", key),
    409,
    "IDEMPOTENCY_KEY_REUSED",
  );
  await error(
    await mutate(
      actor,
      "",
      { ...initial(), templateVersionId: "future-v2" },
      "POST",
      key,
    ),
    409,
    "IDEMPOTENCY_KEY_REUSED",
  );
  expect(await db.project.count({ where: { ownerId: actor.id } })).toBe(1);
  const stored = await db.project.findUniqueOrThrow({
    where: { id: project.id },
  });
  expect(stored.creationKeyHash).toBe(
    createHash("sha256").update(key).digest("hex"),
  );
  expect(stored.creationPayloadHash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(stored)).not.toContain(key);
});

test("concurrent same-key requests create exactly one draft; key is scoped to owner", async () => {
  const a = await owner();
  const b = await owner();
  const key = randomUUID();
  const responses = await Promise.all([
    mutate(a, "", initial(), "POST", key),
    mutate(a, "", initial(), "POST", key),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 201,
  ]);
  const projects = await Promise.all(
    responses.map(async (response) => (await response.json()) as ProjectDto),
  );
  expect(projects[0].id).toBe(projects[1].id);
  expect((await mutate(b, "", initial(), "POST", key)).status).toBe(201);
});

test("create replay works through another application instance, not an in-memory receipt", async () => {
  const actor = await owner();
  const key = randomUUID();
  const project = (await (
    await mutate(actor, "", initial(), "POST", key)
  ).json()) as ProjectDto;
  const other = await createApplication();
  try {
    await other.listen(0, "127.0.0.1");
    const replay = await mutate(
      actor,
      "",
      initial(),
      "POST",
      key,
      await other.getUrl(),
    );
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as ProjectDto).id).toBe(project.id);
  } finally {
    await other.close();
  }
});

test("five draft quota is atomic at the last slot and independent for another owner", async () => {
  const a = await owner();
  const b = await owner();
  for (let n = 0; n < 4; n++) await create(a);
  const responses = await Promise.all(
    Array.from({ length: 4 }, () => mutate(a, "", initial())),
  );
  expect(responses.filter((response) => response.status === 201)).toHaveLength(
    1,
  );
  for (const response of responses.filter((item) => item.status !== 201))
    await error(response, 409, "DRAFT_LIMIT_REACHED");
  expect(
    await db.project.count({
      where: { ownerId: a.id, firstPublishedAt: null, deletedAt: null },
    }),
  ).toBe(5);
  expect((await mutate(b, "", initial())).status).toBe(201);
});

test("published and deleted fixtures do not count as drafts; published content is locked", async () => {
  const actor = await owner();
  const published = await create(actor);
  const deleted = await create(actor);
  await db.project.update({
    where: { id: published.id },
    data: { firstPublishedAt: new Date() },
  });
  await db.project.update({
    where: { id: deleted.id },
    data: { deletedAt: new Date() },
  });
  for (let n = 0; n < 5; n++) await create(actor);
  await error(await mutate(actor, "", initial()), 409, "DRAFT_LIMIT_REACHED");
  await error(
    await mutate(
      actor,
      `/${published.id}/draft`,
      saveInput(published),
      "PATCH",
    ),
    409,
    "CONTENT_LOCKED",
  );
  const read = (await (
    await get(actor, `/${published.id}`)
  ).json()) as ProjectDto;
  expect(read.canEditDraft).toBe(false);
  expect(read.revision).toBe(1);
  await error(await get(actor, `/${deleted.id}`), 404, "PROJECT_NOT_FOUND");
  await error(
    await mutate(actor, `/${deleted.id}/draft`, saveInput(deleted), "PATCH"),
    404,
    "PROJECT_NOT_FOUND",
  );
  const list = (await (await get(actor, "")).json()) as ProjectListDto;
  expect(list.items).toHaveLength(6);
  expect(list.items.map((item) => item.id)).not.toContain(deleted.id);
});

test("deleted create replay returns 404 without resurrection", async () => {
  const actor = await owner();
  const key = randomUUID();
  const project = (await (
    await mutate(actor, "", initial(), "POST", key)
  ).json()) as ProjectDto;
  await db.project.update({
    where: { id: project.id },
    data: { deletedAt: new Date() },
  });
  await error(
    await mutate(actor, "", initial(), "POST", key),
    404,
    "PROJECT_NOT_FOUND",
  );
  expect(await db.project.count({ where: { ownerId: actor.id } })).toBe(1);
});

test("two tabs save one revision once; stale retry after a lost response cannot overwrite the winner", async () => {
  const actor = await owner();
  const project = await create(actor);
  const responses = await Promise.all([
    mutate(
      actor,
      `/${project.id}/draft`,
      saveInput(project, "Первое"),
      "PATCH",
    ),
    mutate(
      actor,
      `/${project.id}/draft`,
      saveInput(project, "Второе"),
      "PATCH",
    ),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 409,
  ]);
  const success = responses.find((response) => response.status === 200)!;
  const saved = (await success.json()) as ProjectDto;
  expect(saved.revision).toBe(2);
  await error(
    await mutate(
      actor,
      `/${project.id}/draft`,
      saveInput(project, "Позднее"),
      "PATCH",
    ),
    409,
    "REVISION_CONFLICT",
  );
  expect(await (await get(actor, `/${project.id}`)).json()).toEqual(saved);
});

test.each([undefined, "short", "../invalid"])(
  "create requires a bounded UUID idempotency key: %s",
  async (key) => {
    const actor = await owner();
    const headers = await csrfHeaders(url, actor.cookie);
    const response = await fetch(`${url}/api/v1/projects`, {
      method: "POST",
      headers: {
        ...headers,
        Origin: TEST_ORIGIN,
        "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: JSON.stringify(initial()),
    });
    await error(response, 422, "VALIDATION_FAILED");
    expect(await db.project.count({ where: { ownerId: actor.id } })).toBe(0);
  },
);

test("unknown template and invalid titles have no database side effect", async () => {
  const actor = await owner();
  await error(
    await mutate(actor, "", { ...initial(), templateVersionId: "unknown-v1" }),
    404,
    "TEMPLATE_NOT_FOUND",
  );
  await error(
    await mutate(actor, "", initial("я".repeat(25))),
    422,
    "VALIDATION_FAILED",
  );
  await error(
    await mutate(actor, "", { ...initial(), ownerId: actor.id, revision: 9 }),
    422,
    "VALIDATION_FAILED",
  );
  const valid = await create(actor, "😀".repeat(24));
  expect(valid.title).toBe("😀".repeat(24));
  expect(await db.project.count({ where: { ownerId: actor.id } })).toBe(1);
});

test.each(["\u0000", "\ud800", "\udc00"])(
  "unrepresentable JSONB text is rejected without replacing saved content: %j",
  async (text) => {
    const actor = await owner();
    const project = await create(actor);
    const input = saveInput(project);
    input.content.copy.introduction = `Привет${text}`;
    const response = await mutate(
      actor,
      `/${project.id}/draft`,
      input,
      "PATCH",
    );
    const details = await error(response, 422, "VALIDATION_FAILED");
    expect(details.fields).toContainEqual({
      path: "content.copy.introduction",
      code: "INVALID_VALUE",
    });
    expect(await (await get(actor, `/${project.id}`)).json()).toEqual(project);
  },
);

test("save rejects invalid nested content, unknown version/status fields and arbitrary media IDs atomically", async () => {
  const actor = await owner();
  const project = await create(actor);
  const input = saveInput(project);
  input.content.names.first = "я".repeat(21);
  let response = await mutate(actor, `/${project.id}/draft`, input, "PATCH");
  expect(
    (await error(response, 422, "VALIDATION_FAILED")).fields,
  ).toContainEqual({ path: "content.names.first", code: "INVALID_VALUE" });
  for (const extra of [
    { templateVersionId: "other-v1" },
    { firstPublishedAt: null },
    { revision: 999 },
  ])
    await error(
      await mutate(
        actor,
        `/${project.id}/draft`,
        { ...saveInput(project), ...extra },
        "PATCH",
      ),
      422,
      "VALIDATION_FAILED",
    );
  const media = saveInput(project);
  media.content.heroMediaId = randomUUID();
  response = await mutate(actor, `/${project.id}/draft`, media, "PATCH");
  expect(
    (await error(response, 422, "VALIDATION_FAILED")).fields,
  ).toContainEqual({ path: "content.heroMediaId", code: "MEDIA_NOT_FOUND" });
  await error(
    await mutate(
      actor,
      `/${project.id}/draft`,
      { ...saveInput(project), expectedRevision: "1" },
      "PATCH",
    ),
    422,
    "VALIDATION_FAILED",
  );
  expect(await (await get(actor, `/${project.id}`)).json()).toEqual(project);
});

test("malformed/oversized JSON and invalid ID are safe errors; corrupted persisted content is not blamed on GET caller", async () => {
  const actor = await owner();
  const csrf = await csrfHeaders(url, actor.cookie);
  const headers = {
    ...csrf,
    Origin: TEST_ORIGIN,
    "Content-Type": "application/json",
  };
  await error(
    await fetch(`${url}/api/v1/projects`, {
      method: "POST",
      headers,
      body: '{"title":',
    }),
    400,
    "MALFORMED_JSON",
  );
  await error(
    await fetch(`${url}/api/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(initial("x".repeat(120000))),
    }),
    413,
    "BODY_TOO_LARGE",
  );
  await error(await get(actor, "/not-a-uuid"), 422, "VALIDATION_FAILED");
  const project = await create(actor);
  await db.project.update({ where: { id: project.id }, data: { content: {} } });
  const details = await error(
    await get(actor, `/${project.id}`),
    503,
    "SERVICE_UNAVAILABLE",
  );
  expect(details).not.toHaveProperty("stack");
});

test("a create failure after insert rolls back the project and key; retry can succeed", async () => {
  const actor = await owner();
  const key = randomUUID();
  const templates = app.get(GardenTemplateService);
  const invalidPreset = templates.createDraft("wedding-garden-v1", "Наш день");
  invalidPreset.content.copy.introduction = "x".repeat(4001);
  // Inject a bad future preset: JSONB insert succeeds, response validation fails before transaction commit.
  const fault = vi
    .spyOn(templates, "createDraft")
    .mockReturnValueOnce(invalidPreset);
  try {
    await error(
      await mutate(actor, "", initial(), "POST", key),
      503,
      "SERVICE_UNAVAILABLE",
    );
  } finally {
    fault.mockRestore();
  }
  expect(await db.project.count({ where: { ownerId: actor.id } })).toBe(0);
  expect((await mutate(actor, "", initial(), "POST", key)).status).toBe(201);
});

test("replay still works at the draft limit and after a published fixture without creating a new period", async () => {
  const actor = await owner();
  const key = randomUUID();
  const project = (await (
    await mutate(actor, "", initial(), "POST", key)
  ).json()) as ProjectDto;
  for (let n = 0; n < 4; n++) await create(actor);
  expect((await mutate(actor, "", initial(), "POST", key)).status).toBe(200);
  const firstPublishedAt = new Date("2026-11-01T00:00:00Z");
  await db.project.update({
    where: { id: project.id },
    data: { firstPublishedAt },
  });
  const replay = await mutate(actor, "", initial(), "POST", key);
  expect(replay.status).toBe(200);
  const result = (await replay.json()) as ProjectDto;
  expect(result.firstPublishedAt).toBe(firstPublishedAt.toISOString());
  expect(result.canEditDraft).toBe(false);
  expect(await db.project.count({ where: { ownerId: actor.id } })).toBe(5);
});

test("OpenAPI documents private security, generated nested body, revisions and idempotency", () => {
  const document = createOpenApiDocument(app);
  const createOperation = document.paths["/api/v1/projects"]?.post;
  expect(createOperation?.operationId).toBe("createProject");
  expect(createOperation?.security).toEqual([{ session: [] }]);
  expect(createOperation?.responses).toHaveProperty("201");
  expect(createOperation?.responses).toHaveProperty("200");
  expect(createOperation?.parameters).toContainEqual(
    expect.objectContaining({ name: "Idempotency-Key", required: true }),
  );
  expect(
    document.paths["/api/v1/projects/{id}/draft"]?.patch?.operationId,
  ).toBe("saveProjectDraft");
  expect(document.components?.schemas?.SaveProjectDraftDto).toMatchObject({
    required: expect.arrayContaining(["title", "content", "expectedRevision"]),
  });
});

test("CORS preflight allows PATCH/idempotency for the configured web origin only", async () => {
  const response = await fetch(`${url}/api/v1/projects`, {
    method: "OPTIONS",
    headers: {
      Origin: TEST_ORIGIN,
      "Access-Control-Request-Method": "PATCH",
      "Access-Control-Request-Headers":
        "X-CSRF-Token,Idempotency-Key,Content-Type",
    },
  });
  expect(response.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
  expect(response.headers.get("access-control-allow-methods")).toContain(
    "PATCH",
  );
  expect(
    response.headers.get("access-control-allow-headers")?.toLowerCase(),
  ).toContain("idempotency-key");
  const foreign = await fetch(`${url}/api/v1/projects`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://foreign.example.test",
      "Access-Control-Request-Method": "PATCH",
    },
  });
  expect(foreign.headers.get("access-control-allow-origin")).not.toBe(
    "https://foreign.example.test",
  );
});
