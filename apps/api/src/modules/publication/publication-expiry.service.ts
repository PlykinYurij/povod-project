import { Injectable } from "@nestjs/common";
import { Prisma } from "../../database/generated/client";
import { DatabaseService } from "../../database/database.service";

const batchSize = 100;

@Injectable()
export class PublicationExpiryService {
  constructor(private readonly database: DatabaseService) {}

  runOnce(): Promise<number> {
    return this.database.getClient().$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<{ id: string }[]>`
        SELECT p.id FROM projects p JOIN publications pub ON pub.project_id = p.id
        WHERE p.deleted_at IS NULL
          AND pub.paused_at IS NULL AND pub.expires_at <= statement_timestamp()
        ORDER BY pub.expires_at, p.id
        LIMIT ${batchSize}
        FOR UPDATE OF p SKIP LOCKED
      `;
      if (candidates.length === 0) return 0;

      // Re-read the publication after taking the same project lock as resume and RSVP.
      return tx.$executeRaw`
        UPDATE projects p SET deleted_at = statement_timestamp()
        FROM publications pub
        WHERE pub.project_id = p.id AND p.id IN (
          ${Prisma.join(candidates.map(({ id }) => Prisma.sql`${id}::uuid`))}
        )
          AND p.deleted_at IS NULL
          AND pub.paused_at IS NULL AND pub.expires_at <= statement_timestamp()
      `;
    }, { isolationLevel: "ReadCommitted" });
  }
}
