import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import type { Prisma } from "../../database/generated/client";
import { jsonContent, saveLockedDraft } from "../projects/project-content";
import type { SaveProjectDraftDto } from "../projects/project.dto";
import { projectResponse } from "../projects/project-mapping";
import { assertStorableContent } from "../projects/storable-content";
import { requestPayloadHash } from "../requests/request-digests";
import { requestPriceData } from "../requests/request-price";
import { GardenTemplateService } from "../templates/garden/garden-template.service";
import { TemplateCatalogService } from "../templates/template-catalog.service";
import { requireAdminForWrite } from "./admin-write";
import type { CreateAssistedProjectDto } from "./assisted-project.dto";

@Injectable()
export class AssistedProjectsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly catalog: TemplateCatalogService,
    private readonly templates: GardenTemplateService,
  ) {}

  private async lockAssistance(tx: Prisma.TransactionClient, id: string) {
    const [locked] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "service_requests" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
    if (!locked)
      throw new ApiError(404, "REQUEST_NOT_FOUND", "Заявка не найдена");
    const request = await tx.serviceRequest.findUniqueOrThrow({
      where: { id },
      include: { project: true },
    });
    if (request.kind !== "ASSISTANCE" || request.customerUserId !== null)
      throw new ApiError(
        409,
        "NOT_ASSISTANCE_REQUEST",
        "Заявка уже относится к проекту пользователя",
      );
    return request;
  }

  async create(actorId: string, id: string, input: CreateAssistedProjectDto) {
    assertStorableContent(input);
    const payloadHash = requestPayloadHash([
      input.templateVersionId,
      input.title,
    ]);
    return this.database.getClient().$transaction(async (tx) => {
      await requireAdminForWrite(tx, actorId);
      const request = await this.lockAssistance(tx, id);
      if (request.project) {
        if (
          request.project.deletedAt ||
          request.project.ownerId !== null ||
          request.project.creationPayloadHash !== payloadHash
        )
          throw new ApiError(
            409,
            "REQUEST_PROJECT_EXISTS",
            "По заявке уже есть проект",
          );
        return projectResponse(request.project);
      }
      if (
        request.requestVersion !== input.expectedRequestVersion ||
        !["NEW", "IN_PROGRESS"].includes(request.status)
      )
        throw new ApiError(
          409,
          "REQUEST_STATE_CONFLICT",
          "Состояние заявки изменилось",
        );
      await this.catalog.assertAvailableForCreation(
        tx,
        input.templateVersionId,
      );
      const draft = this.templates.createDraft(
        input.templateVersionId,
        input.title,
      );
      const project = await tx.project.create({
        data: {
          ownerId: null,
          createdByUserId: actorId,
          templateVersionId: draft.templateVersionId,
          title: draft.title,
          content: jsonContent(draft.content),
          creationKeyHash: requestPayloadHash(["assisted", id]),
          creationPayloadHash: payloadHash,
        },
      });
      await tx.serviceRequest.update({
        where: { id },
        data: {
          projectId: project.id,
          status: "IN_PROGRESS",
          requestVersion: { increment: 1 },
          ...requestPriceData(
            await this.catalog.projectPrice(tx, draft.templateVersionId),
          ),
        },
      });
      return projectResponse(project);
    });
  }

  async save(actorId: string, id: string, input: SaveProjectDraftDto) {
    return this.database.getClient().$transaction(async (tx) => {
      await requireAdminForWrite(tx, actorId);
      const request = await this.lockAssistance(tx, id);
      const project = request.project;
      if (!project || project.ownerId !== null || project.deletedAt)
        throw new ApiError(404, "PROJECT_NOT_FOUND", "Проект не найден");
      return saveLockedDraft(tx, project, input);
    });
  }
}
