import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { publicationLifecycleFields } from "../publication/publication-lifecycle";

@Injectable()
export class ProjectAccessService {
  constructor(private readonly database: DatabaseService) {}

  async owned(
    ownerId: string,
    id: string,
    client: Prisma.TransactionClient = this.database.getClient(),
  ) {
    const project = await client.project.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: { publication: { select: publicationLifecycleFields } },
    });
    if (!project)
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Проект не найден");
    return project;
  }

  async lockOwner(
    tx: Prisma.TransactionClient,
    ownerId: string,
  ): Promise<void> {
    const users = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM users WHERE id = ${ownerId}::uuid FOR UPDATE`;
    if (!users.length)
      throw new ApiError(401, "AUTH_REQUIRED", "Войдите в аккаунт");
  }

  async lockOwned(
    tx: Prisma.TransactionClient,
    ownerId: string,
    id: string,
  ) {
    // Shared by saves and order intake: owner -> project, never the reverse.
    await this.lockOwner(tx, ownerId);
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM projects WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid AND deleted_at IS NULL FOR UPDATE`;
    if (!rows.length)
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Проект не найден");
    return this.owned(ownerId, id, tx);
  }
}
