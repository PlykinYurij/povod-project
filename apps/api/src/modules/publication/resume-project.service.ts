import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { assertReadyHeroPhoto, jsonContent } from "../projects/project-content";
import { templatePhoto, templateValidators } from "../templates/template-content";
import { ApiError } from "../../http/api-error";
import { requestPayloadHash } from "../requests/request-digests";
import {
  publicationStatus,
  readPublicationClock,
} from "./publication-lifecycle";
import { lockAdminPublication } from "./publication-locks";
import {
  type ResumeProjectDto,
  type ResumeReceiptDto,
} from "./resume-project.dto";

@Injectable()
export class ResumeProjectService {
  constructor(private readonly database: DatabaseService) {}

  async resume(
    actorId: string,
    projectId: string,
    input: ResumeProjectDto,
    key: string,
  ): Promise<ResumeReceiptDto> {
    const keyHash = requestPayloadHash([
      "admin-resume",
      actorId,
      key.toLowerCase(),
    ]);
    const payloadHash = requestPayloadHash([
      input.expectedPublicationVersion,
      input.expectedProjectRevision,
    ]);
    return this.database.getClient().$transaction(async (tx) => {
      const { project, publication } = await lockAdminPublication(tx, actorId, projectId);

      const previous = await tx.publicationResumeReceipt.findUnique({
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
        return mapResumeReceipt(previous);
      }
      if (project.revision !== input.expectedProjectRevision)
        throw new ApiError(
          409,
          "REVISION_CONFLICT",
          "Версия проекта изменилась",
        );

      const status = publicationStatus(publication, await readPublicationClock(tx));
      if (
        publication.version !== input.expectedPublicationVersion ||
        publication.version === 2_147_483_647 ||
        (status !== "PAUSED" && status !== "UNPUBLISHED")
      )
        throw new ApiError(
          409,
          "PUBLICATION_STATE_CONFLICT",
          "Состояние публикации изменилось",
        );

      const snapshot = await tx.publicationSnapshot.findFirst({
        where: { publicationId: publication.id, supersededAt: null },
      });
      if (!snapshot)
        throw new ApiError(409, "PUBLICATION_STATE_CONFLICT", "Снимок публикации не найден");

      const draft = templateValidators(project.templateVersionId).complete({
        templateVersionId: project.templateVersionId,
        title: project.title,
        content: project.content,
      });
      await assertReadyHeroPhoto(tx, project.id, templatePhoto(draft.content));

      const now = await readPublicationClock(tx);
      if (publicationStatus(publication, now) === "EXPIRED")
        throw new ApiError(409, "PUBLICATION_STATE_CONFLICT", "Срок публикации истёк");
      const expiresAt = publication.pausedAt
        ? new Date(now.getTime() + publication.expiresAt.getTime() - publication.pausedAt.getTime())
        : publication.expiresAt;
      if (snapshot.projectRevision !== project.revision) {
        await tx.publicationSnapshot.update({
          where: { id: snapshot.id },
          data: { supersededAt: now },
        });
        await tx.publicationSnapshot.create({
          data: {
            publicationId: publication.id,
            projectRevision: project.revision,
            content: jsonContent(draft.content),
            formSchema: snapshot.formSchema,
            createdAt: now,
          },
        });
      }
      const updated = await tx.publication.update({
        where: { id: publication.id },
        data: { visible: true, pausedAt: null, expiresAt, version: { increment: 1 } },
      });
      const receipt = await tx.publicationResumeReceipt.create({
        data: {
          publicationId: publication.id,
          keyHash,
          payloadHash,
          actorId,
          createdAt: now,
          publicationVersion: updated.version,
          expiresAt,
        },
      });
      return mapResumeReceipt(receipt);
    });
  }
}

function mapResumeReceipt(receipt: {
  publicationId: string;
  publicationVersion: number;
  expiresAt: Date;
}): ResumeReceiptDto {
  return {
    publicationId: receipt.publicationId,
    publicationVersion: receipt.publicationVersion,
    expiresAt: receipt.expiresAt.toISOString(),
    status: "PUBLISHED",
    remainingMs: null,
  };
}
