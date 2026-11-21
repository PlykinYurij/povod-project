import type { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";

export async function requireAdminForWrite(
  tx: Prisma.TransactionClient,
  actorId: string,
): Promise<void> {
  const [actor] = await tx.$queryRaw<{ role: string }[]>`
    SELECT "role" FROM "users" WHERE "id" = ${actorId}::uuid FOR SHARE
  `;
  if (actor?.role !== "ADMIN")
    throw new ApiError(403, "ADMIN_REQUIRED", "Требуются права администратора");
}
