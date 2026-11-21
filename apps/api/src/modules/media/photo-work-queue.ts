import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../database/database.service";

type PhotoWork = {
  id: string;
  projectId: string;
  mime: string;
  sha256: string;
  byteSize: number;
  processingAttempts: number;
  leaseToken: string;
};

const MAX_ATTEMPTS = 3;

@Injectable()
export class PhotoWorkQueue {
  constructor(private readonly database: DatabaseService) {}

  async claim(): Promise<PhotoWork | undefined> {
    const client = this.database.getClient();
    const token = randomUUID();
    // Expired final attempts must not remain PROCESSING forever after a crash.
    await client.$executeRaw`
      UPDATE project_photos SET status = 'FAILED', lease_token = NULL,
        lease_until = NULL, updated_at = now()
      WHERE status = 'PROCESSING' AND processing_attempts >= ${MAX_ATTEMPTS}
        AND lease_until <= now()
    `;
    const [work] = await client.$queryRaw<PhotoWork[]>`
      WITH candidate AS (
        SELECT photo.id FROM project_photos photo
        JOIN projects project ON project.id = photo.project_id
        WHERE photo.status = 'PROCESSING' AND project.deleted_at IS NULL
          AND photo.processing_attempts < ${MAX_ATTEMPTS}
          AND (photo.lease_until IS NULL OR photo.lease_until <= now())
        ORDER BY photo.created_at, photo.id
        LIMIT 1 FOR UPDATE OF photo SKIP LOCKED
      )
      UPDATE project_photos photo SET
        processing_attempts = photo.processing_attempts + 1,
        lease_until = now() + interval '2 minutes',
        lease_token = ${token}::uuid,
        updated_at = now()
      FROM candidate WHERE photo.id = candidate.id
      RETURNING photo.id, photo.project_id AS "projectId", photo.mime,
        photo.sha256, photo.byte_size AS "byteSize",
        photo.processing_attempts AS "processingAttempts", photo.lease_token AS "leaseToken"
    `;
    return work;
  }

  async ready(work: PhotoWork, width: number, height: number): Promise<void> {
    await this.database.getClient().$executeRaw`
      UPDATE project_photos photo SET status = 'READY',
        lease_token = NULL, lease_until = NULL, rendition_token = ${work.leaseToken}::uuid,
        render_width = ${width}, render_height = ${height}, updated_at = now()
      FROM projects project
      WHERE project.id = photo.project_id AND project.deleted_at IS NULL
        AND photo.id = ${work.id}::uuid AND photo.status = 'PROCESSING'
        AND photo.lease_token = ${work.leaseToken}::uuid AND photo.lease_until > now()
    `;
  }

  async fail(work: PhotoWork, invalid: boolean): Promise<void> {
    const status =
      invalid || work.processingAttempts >= MAX_ATTEMPTS
        ? "FAILED"
        : "PROCESSING";
    const delay =
      status === "FAILED" ? null : work.processingAttempts === 1 ? 15 : 60;
    await this.database.getClient().$executeRaw`
      UPDATE project_photos SET status = ${status}::"ProjectPhotoStatus", lease_token = NULL,
        lease_until = now() + ${delay}::integer * interval '1 second', updated_at = now()
      WHERE id = ${work.id}::uuid AND status = 'PROCESSING'
        AND lease_token = ${work.leaseToken}::uuid AND lease_until > now()
    `;
  }
}
