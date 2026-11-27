import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { requestPayloadHash } from "../requests/request-digests";
import {
  publicationStatus,
  readPublicationClock,
} from "./publication-lifecycle";
import { lockAdminPublication } from "./publication-locks";
import {
  mapUnpublishReceipt,
  type UnpublishProjectDto,
} from "./unpublish-project.dto";

@Injectable()
export class UnpublishProjectService {
  constructor(private readonly database: DatabaseService) {}

  async unpublish(
    actorId: string,
    projectId: string,
    input: UnpublishProjectDto,
    key: string,
  ) {
    const keyHash = requestPayloadHash([
      "admin-unpublish",
      actorId,
      key.toLowerCase(),
    ]);
    const payloadHash = requestPayloadHash([
      input.expectedPublicationVersion,
      input.expectedProjectRevision,
      input.mode,
      input.reason,
    ]);
    return this.database.getClient().$transaction(async (tx) => {
      const { project, publication } = await lockAdminPublication(tx, actorId, projectId);

      const previous = await tx.publicationUnpublishReceipt.findUnique({
        where: {
          publicationId_keyHash: { publicationId: publication.id, keyHash },
        },
      });
      if (previous) {
        if (previous.payloadHash !== payloadHash)
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Ключ уже использован для другого запроса",
          );
        return mapUnpublishReceipt(previous);
      }
      if (project.revision !== input.expectedProjectRevision)
        throw new ApiError(
          409,
          "REVISION_CONFLICT",
          "Версия проекта изменилась",
        );

      const now = await readPublicationClock(tx);
      if (
        publication.version !== input.expectedPublicationVersion ||
        publication.version === 2_147_483_647 ||
        publicationStatus(publication, now) !== "PUBLISHED"
      )
        throw new ApiError(
          409,
          "PUBLICATION_STATE_CONFLICT",
          "Состояние публикации изменилось",
        );

      const pausedAt = input.mode === "PAUSE_PERIOD" ? now : null;
      const updated = await tx.publication.update({
        where: { id: publication.id },
        data: { visible: false, pausedAt, version: { increment: 1 } },
      });
      const receipt = await tx.publicationUnpublishReceipt.create({
        data: {
          publicationId: publication.id,
          keyHash,
          payloadHash,
          actorId,
          mode: input.mode,
          reason: input.reason,
          createdAt: now,
          publicationVersion: updated.version,
          expiresAt: updated.expiresAt,
          pausedAt: updated.pausedAt,
        },
      });
      return mapUnpublishReceipt(receipt);
    });
  }
}
