import { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";

export function activePublicationBySlug(slug: string) {
  return Prisma.sql`
    FROM publications p
    JOIN projects project ON project.id = p.project_id
    JOIN publication_snapshots s ON s.publication_id = p.id AND s.superseded_at IS NULL
    WHERE p.slug = ${slug} AND p.visible AND p.expires_at > clock_timestamp()
      AND project.deleted_at IS NULL
  `;
}

export function invitationUnavailable(): ApiError {
  return new ApiError(404, "INVITATION_UNAVAILABLE", "Приглашение недоступно");
}
