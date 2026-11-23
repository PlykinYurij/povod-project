import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { Prisma, RsvpAttendance } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import type { RsvpDashboardDto } from "./rsvp-dashboard.dto";

type Scope =
  | { kind: "owner"; projectId: string; ownerId: string }
  | { kind: "assisted"; requestId: string };

@Injectable()
export class RsvpDashboardService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    scope: Scope,
    attendance?: RsvpAttendance,
  ): Promise<RsvpDashboardDto> {
    return this.database.getClient().$transaction(
      async (tx) => {
        const [clock] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`;
        const publication = await tx.publication.findFirst({
          where: { expiresAt: { gt: clock.now }, project: projectScope(scope) },
          select: { id: true },
        });
        if (!publication) {
          throw new ApiError(
            404,
            "RSVP_DASHBOARD_UNAVAILABLE",
            "Ответы недоступны",
          );
        }
        // The write transaction caps the project at 300 stored replies.
        const rows = await tx.rsvpResponse.findMany({
          where: { publicationId: publication.id },
          select: {
            id: true,
            name: true,
            attendance: true,
            companions: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
        const counts = { total: rows.length, yes: 0, no: 0, companions: 0 };
        for (const row of rows) {
          counts[row.attendance] += 1;
          counts.companions += row.companions;
        }
        const items = rows
          .filter((row) => !attendance || row.attendance === attendance)
          .map(({ createdAt, ...item }) => ({
            ...item,
            receivedAt: createdAt.toISOString(),
          }));
        return { counts, items };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}

function projectScope(scope: Scope): Prisma.ProjectWhereInput {
  if (scope.kind === "owner")
    return { id: scope.projectId, ownerId: scope.ownerId, deletedAt: null };

  return {
    ownerId: null,
    deletedAt: null,
    serviceRequests: {
      some: { id: scope.requestId, kind: "ASSISTANCE", customerUserId: null },
    },
  };
}
