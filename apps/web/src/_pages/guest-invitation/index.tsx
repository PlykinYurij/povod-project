import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import {
  ConfettiInvitation,
  AnniversaryInvitation,
  GardenInvitation,
  TogetherInvitation,
} from "@entities/invitation";
import { GuestRsvp } from "@features/guest-rsvp";
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
  const title =
    "celebrant" in content
      ? content.celebrant.trim()
      : "celebrantName" in content
        ? content.celebrantName.trim()
        : [
            content.names.first,
            "photo" in content
              ? content.copy.separator
              : content.copy.namesConnector,
            content.names.second,
          ]
            .map((part) => part.trim())
            .filter(Boolean)
            .join(" ");
  const summary =
    ("celebrant" in content
      ? content.copy.letter.trim() || content.copy.eyebrow.trim()
      : "celebrantName" in content
        ? content.copy.intro.trim() || content.copy.invitationLabel.trim()
        : "photo" in content
          ? content.copy.intro.trim() || content.copy.eventHeading.trim()
          : content.copy.introduction.trim() ||
            content.copy.detailsTitle.trim()) || title;
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
  const { cover, content, rsvp, snapshotId } = invitation;
  if ("celebrant" in content)
    return (
      <main>
        <AnniversaryInvitation
          content={content}
          media={
            cover
              ? { status: "ready", src: `/cover/${snapshotId}`, ...cover }
              : undefined
          }
          renderRsvp={({ label, className }) => (
            <GuestRsvp
              slug={slug}
              schema={rsvp}
              locale={content.locale}
              submitLabel={label}
              submitClassName={className}
            />
          )}
        />
      </main>
    );
  if ("celebrantName" in content)
    return (
      <main>
        <ConfettiInvitation
          content={content}
          media={
            cover
              ? { status: "ready", src: `/cover/${snapshotId}`, ...cover }
              : undefined
          }
          renderRsvp={({ label, className }) => (
            <GuestRsvp
              slug={slug}
              schema={rsvp}
              locale={content.locale}
              submitLabel={label}
              submitClassName={className}
            />
          )}
        />
      </main>
    );
  if ("photo" in content)
    return (
      <main>
        <TogetherInvitation
          content={content}
          media={
            cover
              ? { status: "ready", src: `/cover/${snapshotId}`, ...cover }
              : undefined
          }
          renderRsvp={({ label, className }) => (
            <GuestRsvp
              slug={slug}
              schema={rsvp}
              locale={content.locale}
              submitLabel={label}
              submitClassName={className}
            />
          )}
        />
      </main>
    );
  const t = getGardenTranslations(content.locale);
  return (
    <main>
      <GardenInvitation
        content={content}
        rsvp={<GuestRsvp slug={slug} schema={rsvp} locale={content.locale} />}
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
