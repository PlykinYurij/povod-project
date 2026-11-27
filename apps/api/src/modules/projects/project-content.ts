import type { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import {
  canEditProject,
  publicationLifecycleFields,
  readPublicationClock,
} from "../publication/publication-lifecycle";
import {
  templatePhoto,
  templateValidators,
} from "../templates/template-content";
import type { SaveProjectDraftDto } from "./project.dto";
import { projectResponse, type ProjectWithPublication } from "./project-mapping";
import { assertStorableContent } from "./storable-content";

export function jsonContent(content: object): Prisma.InputJsonObject {
  // Draft DTOs contain only JSON primitives after validation.
  return JSON.parse(JSON.stringify(content)) as Prisma.InputJsonObject;
}

/** Caller holds the relevant project/request locks and has already checked access. */
export async function saveLockedDraft(
  tx: Prisma.TransactionClient,
  project: ProjectWithPublication,
  input: SaveProjectDraftDto,
) {
  if (!canEditProject(project, await readPublicationClock(tx)))
    throw new ApiError(
      409,
      "CONTENT_LOCKED",
      "Проект закрыт для редактирования",
    );
  if (project.revision !== input.expectedRevision)
    throw new ApiError(409, "REVISION_CONFLICT", "Версия проекта изменилась");
  const draft = templateValidators(project.templateVersionId).draft({
    templateVersionId: project.templateVersionId,
    title: input.title,
    content: input.content,
  });
  assertStorableContent(draft);
  await assertReadyHeroPhoto(tx, project.id, templatePhoto(draft.content));
  const updated = await tx.project.updateMany({
    where: {
      id: project.id,
      ownerId: project.ownerId,
      deletedAt: null,
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
    await tx.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { publication: { select: publicationLifecycleFields } },
    }),
  );
}

export async function assertReadyHeroPhoto(
  tx: Prisma.TransactionClient,
  projectId: string,
  photo: ReturnType<typeof templatePhoto>,
): Promise<void> {
  if (photo.id === null) return;
  const ready = await tx.projectPhoto.findFirst({
    where: {
      id: photo.id,
      projectId,
      status: "READY",
      renditionToken: { not: null },
    },
    select: { id: true },
  });
  if (!ready)
    throw new ApiError(422, "VALIDATION_FAILED", "Готовое фото не найдено", [
      { path: photo.path, code: "MEDIA_NOT_FOUND" },
    ]);
}
