import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import type {
  Prisma,
  Project,
  ServiceRequest,
} from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { assertReadyHeroPhoto, jsonContent } from "../projects/project-content";
import { requestPayloadHash } from "../requests/request-digests";
import { readRequestPrice } from "../requests/request-price";
import { validateGardenComplete } from "../templates/garden/validate-garden";
import { lockPublicationContext } from "./publication-locks";
import { readPublicationClock, unexpiredPublication } from "./publication-lifecycle";
import { publicationUrl } from "./publication-address";
import {
  toPublicationReceipt,
  type PublishRequestDto,
} from "./publish-request.dto";

const PUBLICATION_DURATION_MS = 90 * 24 * 60 * 60 * 1_000;
const ACTIVE_PUBLICATION_LIMIT = 2;

@Injectable()
export class PublishRequestService {
  constructor(private readonly database: DatabaseService) {}

  async publish(
    actorId: string,
    requestId: string,
    input: PublishRequestDto,
    key: string,
  ) {
    const keyHash = requestPayloadHash(["admin-publish", key.toLowerCase()]);
    const payloadHash = requestPayloadHash([
      input.expectedRequestVersion,
      input.expectedProjectRevision,
      input.expectedPriceVersion,
      input.slug,
    ]);
    return this.database.getClient().$transaction(
      async (tx) => {
        const { request, project } = await lockPublicationContext(
          tx,
          actorId,
          requestId,
        );
        const previous = request.publicationReceipt;
        if (previous) {
          if (previous.keyHash !== keyHash) {
            throw new ApiError(
              409,
              "ALREADY_PUBLISHED",
              "Публикация уже оформлена",
            );
          }
          if (previous.payloadHash !== payloadHash) {
            throw new ApiError(
              409,
              "IDEMPOTENCY_KEY_REUSED",
              "Ключ уже использован для другого запроса",
            );
          }
          return { receipt: toPublicationReceipt(previous), replay: true };
        }
        const draft = await validateReviewedDraft(tx, request, project, input);
        const url = publicationUrl(input.slug);
        const now = await readPublicationClock(tx);
        if (project.ownerId !== null)
          await assertOwnerSlot(tx, project.ownerId, now);
        const expiresAt = new Date(now.getTime() + PUBLICATION_DURATION_MS);
        const publicationId = randomUUID();
        const inserted = await tx.$executeRaw`
        INSERT INTO publications (id, project_id, slug, visible, expires_at)
        VALUES (${publicationId}::uuid, ${project.id}::uuid, ${input.slug}, true, ${expiresAt})
        ON CONFLICT (slug) DO NOTHING
      `;
        if (inserted !== 1) {
          throw new ApiError(409, "SLUG_TAKEN", "Это имя адреса уже занято", [
            { path: "slug", code: "UNAVAILABLE" },
          ]);
        }
        const snapshot = await tx.publicationSnapshot.create({
          data: {
            publicationId,
            projectRevision: project.revision,
            content: jsonContent(draft.content),
            formSchema: "garden_v1",
            createdAt: now,
          },
          select: { id: true },
        });
        await tx.project.update({
          where: { id: project.id },
          data: { firstPublishedAt: now },
        });
        const completed = await tx.serviceRequest.update({
          where: { id: requestId },
          data: { status: "COMPLETED", requestVersion: { increment: 1 } },
          select: { requestVersion: true },
        });
        const receipt = await tx.publicationReceipt.create({
          data: {
            requestId,
            publicationId,
            snapshotId: snapshot.id,
            actorId,
            keyHash,
            payloadHash,
            url,
            requestVersion: completed.requestVersion,
            publishedAt: now,
            expiresAt,
          },
        });
        return { receipt: toPublicationReceipt(receipt), replay: false };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}

async function validateReviewedDraft(
  tx: Prisma.TransactionClient,
  request: ServiceRequest,
  project: Project,
  input: PublishRequestDto,
) {
  if (
    request.requestVersion !== input.expectedRequestVersion ||
    !["NEW", "IN_PROGRESS"].includes(request.status)
  ) {
    throw new ApiError(
      409,
      "REQUEST_STATE_CONFLICT",
      "Состояние заявки изменилось",
    );
  }
  if (project.firstPublishedAt) {
    throw new ApiError(409, "ALREADY_PUBLISHED", "Публикация уже оформлена");
  }
  if (project.revision !== input.expectedProjectRevision) {
    throw new ApiError(
      409,
      "REVISION_CONFLICT",
      "Откройте актуальный предпросмотр проекта",
    );
  }
  const quote = readRequestPrice(request);
  if (!quote) {
    throw new ApiError(
      409,
      "PRICE_NOT_CONFIGURED",
      "У заявки нет зафиксированной стоимости",
    );
  }
  if (quote.version !== input.expectedPriceVersion) {
    throw new ApiError(
      409,
      "PRICE_CHANGED",
      "Откройте актуальную стоимость заявки",
    );
  }
  const draft = validateGardenComplete({
    templateVersionId: project.templateVersionId,
    title: project.title,
    content: project.content,
  });
  await assertReadyHeroPhoto(tx, project.id, draft.content.heroMediaId);
  return draft;
}

async function assertOwnerSlot(
  tx: Prisma.TransactionClient,
  ownerId: string,
  now: Date,
) {
  // A hidden publication with remaining time still occupies a slot.
  const used = await tx.publication.count({
    where: { ...unexpiredPublication(now), project: { ownerId, deletedAt: null } },
  });
  if (used >= ACTIVE_PUBLICATION_LIMIT) {
    throw new ApiError(
      409,
      "PUBLICATION_LIMIT_REACHED",
      "Оба места публикации заняты",
    );
  }
}
