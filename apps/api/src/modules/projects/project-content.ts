import type { Prisma, Project } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { validateGardenDraft } from "../templates/garden/validate-garden";
import type { SaveProjectDraftDto } from "./project.dto";
import { projectResponse } from "./project-mapping";
import { assertStorableContent } from "./storable-content";

export function jsonContent(content: object): Prisma.InputJsonObject {
  // Draft DTOs contain only JSON primitives after validation.
  return JSON.parse(JSON.stringify(content)) as Prisma.InputJsonObject;
}

/** Caller holds the relevant project/request locks and has already checked access. */
export async function saveLockedDraft(
  tx: Prisma.TransactionClient,
  project: Project,
  input: SaveProjectDraftDto,
) {
  if (project.firstPublishedAt)
    throw new ApiError(
      409,
      "CONTENT_LOCKED",
      "Опубликованный проект закрыт для редактирования",
    );
  if (project.revision !== input.expectedRevision)
    throw new ApiError(409, "REVISION_CONFLICT", "Версия проекта изменилась");
  const draft = validateGardenDraft({
    templateVersionId: project.templateVersionId,
    title: input.title,
    content: input.content,
  });
  assertStorableContent(draft);
  await assertReadyHeroPhoto(tx, project.id, draft.content.heroMediaId);
  const updated = await tx.project.updateMany({
    where: {
      id: project.id,
      ownerId: project.ownerId,
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
    throw new ApiError(409, "REVISION_CONFLICT", "Версия проекта изменилась");
  return projectResponse(
    await tx.project.findUniqueOrThrow({ where: { id: project.id } }),
  );
}

export async function assertReadyHeroPhoto(
  tx: Prisma.TransactionClient,
  projectId: string,
  photoId: string | null,
): Promise<void> {
  if (photoId === null) return;
  const photo = await tx.projectPhoto.findFirst({
    where: {
      id: photoId,
      projectId,
      status: "READY",
      renditionToken: { not: null },
    },
    select: { id: true },
  });
  if (!photo)
    throw new ApiError(422, "VALIDATION_FAILED", "Готовое фото не найдено", [
      { path: "content.heroMediaId", code: "MEDIA_NOT_FOUND" },
    ]);
}
