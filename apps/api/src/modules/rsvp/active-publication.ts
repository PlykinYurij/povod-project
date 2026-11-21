import type { Prisma, RsvpFormSchema } from "../../database/generated/client";
import {
  activePublicationBySlug,
  invitationUnavailable,
} from "../publication/active-publication";

export async function readActiveRsvpForm(
  tx: Prisma.TransactionClient,
  slug: string,
) {
  const [form] = await tx.$queryRaw<
    {
      publicationId: string;
      formVersionId: string;
      formSchema: RsvpFormSchema;
    }[]
  >`
    SELECT p.id AS "publicationId", s.id AS "formVersionId", s.form_schema::text AS "formSchema"
    ${activePublicationBySlug(slug)}
  `;
  if (!form) throw invitationUnavailable();
  return form;
}

export async function lockPublishedProject(
  tx: Prisma.TransactionClient,
  slug: string,
) {
  // The publication writer must take the same project lock before changing visibility or snapshot.
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT project.id FROM projects project
    JOIN publications p ON p.project_id = project.id
    WHERE p.slug = ${slug} FOR UPDATE OF project
  `;
  if (rows.length === 0) throw invitationUnavailable();
}
