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
  // An operator can also own a project. Ordering the two user rows prevents
  // cross-publications from each holding the other's owner row.
  const users = await tx.$queryRaw<{ id: string; role: string }[]>`
    SELECT id, role::text AS role FROM users
    WHERE id = ${actorId}::uuid OR id = ${candidate?.ownerId ?? null}::uuid
    ORDER BY id FOR NO KEY UPDATE
  `;
  if (!users.some((user) => user.id === actorId && user.role === "ADMIN")) {
    throw new ApiError(403, "ADMIN_REQUIRED", "Требуются права администратора");
  }

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

async function lockProject(tx: Prisma.TransactionClient, projectId: string) {
  // RSVP uses the same project lock before it checks the active snapshot.
  await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
}
