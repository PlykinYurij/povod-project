import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { ProjectAccessService } from "../projects/project-access.service";
import { TemplateCatalogService } from "../templates/template-catalog.service";
import type {
  CreatePublicationRequestDto,
  ProjectPublicationRequestDto,
} from "./publication-request.dto";
import { RequestClock } from "./request-clock";
import { publicationKeyHash, requestPayloadHash } from "./request-digests";
import { RequestRateService } from "./request-rate.service";
import { readRequestPrice, requestPriceData } from "./request-price";
import {
  acceptedRequest,
  limitedRequest,
  type RequestSubmissionResult,
} from "./request-submission";

@Injectable()
export class PublicationRequestsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projects: ProjectAccessService,
    private readonly catalog: TemplateCatalogService,
    private readonly clock: RequestClock,
    private readonly rate: RequestRateService,
  ) {}

  async create(
    actorId: string,
    input: CreatePublicationRequestDto,
    key: string,
    ip: string,
  ): Promise<RequestSubmissionResult> {
    const keyHash = publicationKeyHash(actorId, key);
    const payloadHash = requestPayloadHash([
      input.projectId,
      input.expectedRevision,
      input.expectedPriceVersion,
      input.contactName,
      input.phone,
      input.contactChannel,
      input.contactValue,
      input.privacyConsent,
    ]);
    return this.database.getClient().$transaction(
      async (tx) => {
        const project = await this.projects.lockOwned(
          tx,
          actorId,
          input.projectId,
        );
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${keyHash}, 3))`;
        const previous = await tx.serviceRequest.findUnique({
          where: { creationKeyHash: keyHash },
        });
        if (previous) {
          if (previous.creationPayloadHash !== payloadHash)
            throw new ApiError(
              409,
              "IDEMPOTENCY_KEY_REUSED",
              "Ключ уже использован для другого запроса",
            );
          return acceptedRequest(previous, true);
        }
        if (project.firstPublishedAt)
          throw new ApiError(409, "CONTENT_LOCKED", "Проект уже опубликован");
        const existing = await tx.serviceRequest.findFirst({
          where: {
            projectId: project.id,
            status: { in: ["NEW", "IN_PROGRESS"] },
          },
        });
        if (existing)
          throw new ApiError(
            409,
            "REQUEST_ALREADY_OPEN",
            "Заявка по этому проекту уже отправлена",
          );
        if (project.revision !== input.expectedRevision)
          throw new ApiError(
            409,
            "REVISION_CONFLICT",
            "Версия проекта изменилась",
          );
        const price = await this.catalog.lockProjectPrice(
          tx,
          project.templateVersionId,
        );
        if ((price?.version ?? null) !== input.expectedPriceVersion)
          throw new ApiError(
            409,
            "PRICE_CHANGED",
            "Стоимость изменилась, обновите каталог",
          );
        const now = this.clock.now();
        const denied = await this.rate.reserve(tx, ip, input.phone, now);
        if (denied) return limitedRequest(denied, now);
        const row = await tx.serviceRequest.create({
          data: {
            kind: "PUBLICATION",
            customerUserId: actorId,
            projectId: project.id,
            submittedRevision: project.revision,
            contactName: input.contactName,
            phone: input.phone,
            contactChannel: input.contactChannel,
            contactValue: input.contactValue,
            creationKeyHash: keyHash,
            creationPayloadHash: payloadHash,
            ...requestPriceData(price),
            consentAt: now,
            consentVersion: "contact-request-v1",
            createdAt: now,
            updatedAt: now,
          },
        });
        return acceptedRequest(row, false);
      },
      { isolationLevel: "ReadCommitted" },
    );
  }

  async current(
    actorId: string,
    projectId: string,
  ): Promise<ProjectPublicationRequestDto> {
    return this.database.getClient().$transaction(
      async (tx) => {
        const project = await this.projects.owned(actorId, projectId, tx);
        const row = await tx.serviceRequest.findFirst({
          where: { projectId, status: { in: ["NEW", "IN_PROGRESS"] } },
        });
        const currentPrice = await this.catalog.projectPrice(
          tx,
          project.templateVersionId,
        );
        const closed = await tx.serviceRequest.findFirst({
          where: {
            projectId,
            status: { in: ["REJECTED", "CANCELLED", "COMPLETED"] },
          },
          select: { id: true, status: true, updatedAt: true },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        });
        const lastClosed =
          closed &&
          (closed.status === "REJECTED" ||
            closed.status === "CANCELLED" ||
            closed.status === "COMPLETED")
            ? {
                requestId: closed.id,
                status: closed.status,
                updatedAt: closed.updatedAt.toISOString(),
              }
            : null;
        if (!row) return { currentPrice, request: null, lastClosed };
        // Explicit response, never the contact/hash-bearing ORM row.
        return {
          currentPrice,
          lastClosed,
          request: {
            requestId: row.id,
            kind: row.kind,
            status: row.status === "IN_PROGRESS" ? "IN_PROGRESS" : "NEW",
            requestVersion: row.requestVersion,
            submittedRevision: row.submittedRevision,
            currentProjectRevision: project.revision,
            price: readRequestPrice(row),
            createdAt: row.createdAt.toISOString(),
          },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
