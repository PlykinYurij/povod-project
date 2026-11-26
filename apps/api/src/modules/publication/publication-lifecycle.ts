import type { Prisma } from "../../database/generated/client";

export const publicationLifecycleFields = {
  id: true,
  version: true,
  visible: true,
  expiresAt: true,
  pausedAt: true,
} satisfies Prisma.PublicationSelect;

export type PublicationLifecycle = Prisma.PublicationGetPayload<{
  select: typeof publicationLifecycleFields;
}>;

export function publicationStatus(
  publication: Pick<PublicationLifecycle, "visible" | "expiresAt" | "pausedAt">,
  now: Date,
) {
  if (publication.pausedAt) return "PAUSED" as const;
  if (publication.expiresAt <= now) return "EXPIRED" as const;
  return publication.visible
    ? ("PUBLISHED" as const)
    : ("UNPUBLISHED" as const);
}

export function unexpiredPublication(now: Date): Prisma.PublicationWhereInput {
  return { OR: [{ pausedAt: { not: null } }, { expiresAt: { gt: now } }] };
}

export async function readPublicationClock(tx: Prisma.TransactionClient) {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AS now`;
  return clock.now;
}

type ProjectPublication = {
  firstPublishedAt: Date | null;
  publication?: PublicationLifecycle | null;
};

export function canEditProject(project: ProjectPublication, now: Date) {
  if (!project.publication) return project.firstPublishedAt === null;
  const status = publicationStatus(project.publication, now);
  return status === "PAUSED" || status === "UNPUBLISHED";
}
