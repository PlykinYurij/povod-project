import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { publicationLifecycleFields } from "../publication/publication-lifecycle";
import { GardenTemplateService } from "../templates/garden/garden-template.service";
import { TemplateCatalogService } from "../templates/template-catalog.service";
import { CreateProjectDto, SaveProjectDraftDto } from "./project.dto";
import { projectResponse, projectSummary } from "./project-mapping";
import { assertStorableContent } from "./storable-content";
import { jsonContent, saveLockedDraft } from "./project-content";
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
      include: { publication: { select: publicationLifecycleFields } },
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
          include: { publication: { select: publicationLifecycleFields } },
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
            createdByUserId: ownerId,
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
        return saveLockedDraft(tx, project, input);
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}
