import type { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";

export async function lockPublicationContext(
  tx: Prisma.TransactionClient,
  actorId: string,
  requestId: string,
) {
  // This lookup establishes lock order only. Re-read the relationship under locks.
  const initial = await tx.serviceRequest.findUnique({
    where: { id: requestId },
    select: { project: { select: { id: true, ownerId: true } } },
  });
  const candidate = initial?.project;
  await lockPublicationUsers(tx, actorId, candidate?.ownerId ?? null);

  if (!initial)
    throw new ApiError(404, "REQUEST_NOT_FOUND", "Заявка не найдена");
  if (!candidate)
    throw new ApiError(
      409,
      "REQUEST_PROJECT_REQUIRED",
      "Сначала создайте проект по заявке",
    );

  // Existing owner intake locks project before request. Assisted writes already
  // lock request before project, and have no owner row.
  if (candidate.ownerId !== null) await lockProject(tx, candidate.id);
  await tx.$queryRaw`SELECT id FROM service_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
  if (candidate.ownerId === null) await lockProject(tx, candidate.id);

  const request = await tx.serviceRequest.findUnique({
    where: { id: requestId },
    include: { project: true, publicationReceipt: true },
  });
  if (!request)
    throw new ApiError(404, "REQUEST_NOT_FOUND", "Заявка не найдена");
  const { project } = request;
  if (
    !project ||
    project.id !== candidate.id ||
    project.ownerId !== candidate.ownerId ||
    request.customerUserId !== project.ownerId ||
    (request.kind === "ASSISTANCE") !== (project.ownerId === null)
  ) {
    throw new ApiError(
      409,
      "REQUEST_STATE_CONFLICT",
      "Связь заявки с проектом изменилась",
    );
  }
  if (project.deletedAt) {
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Проект не найден");
  }
  return { request, project };
}

export async function lockPublicationUsers(
  tx: Prisma.TransactionClient,
  actorId: string,
  ownerId: string | null,
) {
  // An operator can also own a project. Ordering both user rows prevents a deadlock.
  const users = await tx.$queryRaw<{ id: string; role: string }[]>`
    SELECT id, role::text AS role FROM users
    WHERE id = ${actorId}::uuid OR id = ${ownerId}::uuid
    ORDER BY id FOR NO KEY UPDATE
  `;
  if (!users.some((user) => user.id === actorId && user.role === "ADMIN")) {
    throw new ApiError(403, "ADMIN_REQUIRED", "Требуются права администратора");
  }
}

export async function lockProject(tx: Prisma.TransactionClient, projectId: string) {
  // RSVP uses the same project lock before it checks the active snapshot.
  await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
}

export async function lockAdminPublication(tx: Prisma.TransactionClient, actorId: string, projectId: string) {
  const initial = await tx.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  await lockPublicationUsers(tx, actorId, initial?.ownerId ?? null);
  if (!initial) throw projectNotFound();
  await lockProject(tx, projectId);
  const project = await tx.project.findUnique({
    where: { id: projectId },
    include: { publication: true },
  });
  if (!project || project.deletedAt) throw projectNotFound();
  if (project.ownerId !== initial.ownerId)
    throw new ApiError(
      409,
      "PUBLICATION_STATE_CONFLICT",
      "Владелец проекта изменился",
    );
  const publication = project.publication;
  if (!publication)
    throw new ApiError(
      409,
      "PUBLICATION_STATE_CONFLICT",
      "У проекта нет публикации",
    );

  return { project, publication };
}

function projectNotFound() {
  return new ApiError(404, "PROJECT_NOT_FOUND", "Проект не найден");
}
