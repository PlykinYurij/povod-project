import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { requireAdminForWrite } from "../administration/admin-write";
import {
  readDashboardPublication,
  type RsvpScope,
} from "./rsvp-dashboard.service";

@Injectable()
export class RsvpDeletionService {
  constructor(private readonly database: DatabaseService) {}

  async remove(
    scope: RsvpScope,
    actorId: string,
    responseId: string,
  ): Promise<void> {
    await this.database.getClient().$transaction(
      async (tx) => {
        if (scope.kind === "assisted") await requireAdminForWrite(tx, actorId);
        const candidate = await readDashboardPublication(tx, scope);
        // Guest submissions and publication transitions serialize on this project row.
        await tx.$queryRaw`SELECT id FROM projects WHERE id = ${candidate.projectId}::uuid FOR UPDATE`;
        const publication = await readDashboardPublication(tx, scope);
        if (
          publication.id !== candidate.id ||
          publication.projectId !== candidate.projectId
        )
          throw new ApiError(
            404,
            "RSVP_DASHBOARD_UNAVAILABLE",
            "Ответы недоступны",
          );

        const where = { id: responseId, publicationId: publication.id };
        const response = await tx.rsvpResponse.findFirst({
          where,
          select: { keyHash: true },
        });
        if (!response) {
          const removed = await tx.rsvpDeletedKey.findFirst({
            where: { responseId, publicationId: publication.id },
            select: { responseId: true },
          });
          if (removed) return;
          throw new ApiError(404, "RSVP_RESPONSE_NOT_FOUND", "Ответ не найден");
        }
        await tx.rsvpDeletedKey.create({
          data: {
            responseId,
            publicationId: publication.id,
            keyHash: response.keyHash,
          },
        });
        await tx.rsvpResponse.delete({ where });
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}
