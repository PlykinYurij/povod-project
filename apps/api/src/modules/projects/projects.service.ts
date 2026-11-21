import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import type { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { GardenTemplateService } from "../templates/garden/garden-template.service";
import { TemplateCatalogService } from "../templates/template-catalog.service";
import { validateGardenDraft } from "../templates/garden/validate-garden";
import { CreateProjectDto, SaveProjectDraftDto } from "./project.dto";
import { projectResponse, projectSummary } from "./project-mapping";
import { assertStorableContent } from "./storable-content";
import { ProjectAccessService } from "./project-access.service";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const DRAFT_LIMIT = 5;
const notFound = () =>
  new ApiError(404, "PROJECT_NOT_FOUND", "Проект не найден");

@Injectable()
export class ProjectsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly templates: GardenTemplateService,
    private readonly catalog: TemplateCatalogService,
    private readonly access: ProjectAccessService,
  ) {}

  async list(ownerId: string) {
    const projects = await this.database.getClient().project.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return { items: projects.map(projectSummary) };
  }

  async get(ownerId: string, id: string) {
    return projectResponse(await this.access.owned(ownerId, id));
  }

  async create(ownerId: string, input: CreateProjectDto, key: string) {
    assertStorableContent(input);
    const keyHash = hash(key.toLowerCase());
    const payloadHash = hash(
      JSON.stringify([input.templateVersionId, input.title]),
    );
    return this.database.getClient().$transaction(
      async (tx) => {
        await this.access.lockOwner(tx, ownerId);
        const previous = await tx.project.findUnique({
          where: {
            ownerId_creationKeyHash: { ownerId, creationKeyHash: keyHash },
          },
        });
        if (previous) {
          if (previous.deletedAt) throw notFound();
          if (previous.creationPayloadHash !== payloadHash)
            throw new ApiError(
              409,
              "IDEMPOTENCY_KEY_REUSED",
              "Ключ уже использован для другого запроса",
            );
          return { project: projectResponse(previous), replay: true };
        }
        await this.catalog.assertAvailableForCreation(
          tx,
          input.templateVersionId,
        );
        const draft = this.templates.createDraft(
          input.templateVersionId,
          input.title,
        );
        const count = await tx.project.count({
          where: { ownerId, firstPublishedAt: null, deletedAt: null },
        });
        if (count >= DRAFT_LIMIT)
          throw new ApiError(
            409,
            "DRAFT_LIMIT_REACHED",
            "Достигнут лимит черновиков",
          );
        const project = await tx.project.create({
          data: {
            ownerId,
            templateVersionId: draft.templateVersionId,
            title: draft.title,
            content: jsonContent(draft.content),
            creationKeyHash: keyHash,
            creationPayloadHash: payloadHash,
          },
        });
        return { project: projectResponse(project), replay: false };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }

  async save(ownerId: string, id: string, input: SaveProjectDraftDto) {
    return this.database.getClient().$transaction(
      async (tx) => {
        const project = await this.access.lockOwned(tx, ownerId, id);
        if (project.firstPublishedAt)
          throw new ApiError(
            409,
            "CONTENT_LOCKED",
            "После публикации структура зафиксирована",
          );
        if (project.revision !== input.expectedRevision)
          throw new ApiError(
            409,
            "REVISION_CONFLICT",
            "Версия проекта изменилась",
          );
        const draft = validateGardenDraft({
          templateVersionId: project.templateVersionId,
          title: input.title,
          content: input.content,
        });
        assertStorableContent(draft);
        // No media objects exist in this stage. Never accept an arbitrary reference as an owned photo.
        if (draft.content.heroMediaId !== null)
          throw new ApiError(422, "VALIDATION_FAILED", "Фото не найдено", [
            { path: "content.heroMediaId", code: "MEDIA_NOT_FOUND" },
          ]);
        const updated = await tx.project.updateMany({
          where: {
            id,
            ownerId,
            deletedAt: null,
            firstPublishedAt: null,
            revision: input.expectedRevision,
          },
          data: {
            title: draft.title,
            content: jsonContent(draft.content),
            revision: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ApiError(
            409,
            "REVISION_CONFLICT",
            "Версия проекта изменилась",
          );
        return projectResponse(
          await tx.project.findUniqueOrThrow({ where: { id } }),
        );
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}

function jsonContent(content: object): Prisma.InputJsonObject {
  // DTOs contain only validated JSON primitives; JSON round-trip yields Prisma's explicit JSON input shape.
  return JSON.parse(JSON.stringify(content)) as Prisma.InputJsonObject;
}
