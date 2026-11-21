import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { GardenInvitation } from "@entities/invitation";
import { ApiRequestError, getGuestPublication } from "@shared/api/server";
import { getGardenTranslations } from "@shared/i18n/garden";

const readInvitation = cache((slug: string) =>
  getGuestPublication(slug, {
    signal: AbortSignal.timeout(10_000),
  }).catch((error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }),
);

export async function guestInvitationMetadata(
  slug: string,
  hostname: string,
): Promise<Metadata> {
  const { cover, content, snapshotId } = await readInvitation(slug);
  const title = [
    content.names.first,
    content.copy.namesConnector,
    content.names.second,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const summary =
    content.copy.introduction.trim() ||
    content.copy.detailsTitle.trim() ||
    title;
  const description = Array.from(summary.replace(/\s+/gu, " "))
    .slice(0, 160)
    .join("");
  const url = `https://${hostname}/`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: cover ? [{ url: url + `cover/${snapshotId}`, ...cover }] : [],
    },
  };
}

export async function GuestInvitationPage({ slug }: { slug: string }) {
  const invitation = await readInvitation(slug);
  const { cover, content, snapshotId } = invitation;
  const t = getGardenTranslations(content.locale);
  return (
    <main>
      <GardenInvitation
        content={content}
        media={
          cover
            ? {
                id: snapshotId,
                src: `/cover/${snapshotId}`,
                alt: t("publishedCoverAlt"),
                width: cover.width,
                height: cover.height,
              }
            : undefined
        }
      />
    </main>
  );
}
