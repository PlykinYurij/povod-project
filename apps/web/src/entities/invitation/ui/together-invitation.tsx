import { useId, type ReactNode } from "react";
import {
  presentGardenDate,
  presentGardenTime,
  presentGardenTimeZone,
  safeGardenImage,
} from "../lib/presentation";
import {
  togetherMessages,
  type TogetherInvitationContent,
  type TogetherInvitationMedia,
} from "../model/together-presentation";
import { TogetherPhoto } from "./together-photo";
import styles from "./together-invitation.module.css";

function InvitationSection({
  heading,
  label,
  children,
}: {
  heading: string;
  label: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const hasHeading = Boolean(heading.trim());

  return (
    <section
      className={styles.section}
      aria-labelledby={hasHeading ? headingId : undefined}
      aria-label={hasHeading ? undefined : label}
    >
      {hasHeading && <h2 id={headingId}>{heading}</h2>}
      {children}
    </section>
  );
}

export function TogetherInvitation({
  content,
  media,
  renderRsvp,
}: {
  content: TogetherInvitationContent;
  media?: TogetherInvitationMedia;
  renderRsvp?: (action: { label: string; className: string }) => ReactNode;
}) {
  const titleId = useId();
  const { locale, names, event, venue, copy, note, photo } = content;
  const t = togetherMessages[locale];
  const hasNames = Boolean(names.first.trim() || names.second.trim());
  const date = presentGardenDate(event.date, locale);
  const time = presentGardenTime(event.startTime);
  const zone = presentGardenTimeZone(event.timeZone);
  const localizedTime = time
    ? new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(new Date(`2000-01-01T${time}:00Z`))
    : null;
  const dateTime = [date, localizedTime, localizedTime && zone]
    .filter(Boolean)
    .join(" · ");
  const photoSrc =
    media?.status === "ready" &&
    Number.isSafeInteger(media.width) &&
    Number.isSafeInteger(media.height) &&
    media.width > 0 &&
    media.height > 0
      ? safeGardenImage(media.src, media.objectUrl)
      : null;

  return (
    <article
      lang={locale}
      aria-labelledby={titleId}
      className={styles.invitation}
    >
      <header className={styles.hero}>
        <div className={styles.heroFrame}>
          <div>
            {copy.heroLabel.trim() && (
              <p className={styles.label}>{copy.heroLabel}</p>
            )}
            <h1 id={titleId} className={styles.names}>
              {hasNames ? (
                <>
                  {names.first.trim() && <span>{names.first}</span>}
                  {names.first.trim() &&
                    names.second.trim() &&
                    copy.separator.trim() && (
                      <span className={styles.separator}>{copy.separator}</span>
                    )}
                  {names.second.trim() && <span>{names.second}</span>}
                </>
              ) : (
                t.draft
              )}
            </h1>
            {copy.intro.trim() && (
              <p className={styles.multiline}>{copy.intro}</p>
            )}
          </div>
          <div className={styles.art} aria-hidden="true" />
        </div>
      </header>
      <div className={styles.frame}>
        <InvitationSection heading={copy.eventHeading} label={t.event}>
          <dl className={styles.details}>
            <div>
              <dt>
                {copy.dateLabel.trim() ? (
                  copy.dateLabel
                ) : (
                  <span className={styles.srOnly}>{t.date}</span>
                )}
              </dt>
              <dd>{dateTime || t.dateMissing}</dd>
            </div>
            <div>
              <dt>
                {copy.venueLabel.trim() ? (
                  copy.venueLabel
                ) : (
                  <span className={styles.srOnly}>{t.venue}</span>
                )}
              </dt>
              <dd className={styles.venue}>
                {venue.name.trim() && <span>{venue.name}</span>}
                {venue.address.trim() && <span>{venue.address}</span>}
                {!venue.name.trim() && !venue.address.trim() && t.venueMissing}
              </dd>
            </div>
          </dl>
        </InvitationSection>
        {media && (
          <InvitationSection heading={copy.photoHeading} label={t.photo}>
            {media.status === "ready" && photoSrc ? (
              <TogetherPhoto
                key={photoSrc}
                src={photoSrc}
                alt={photo.alt}
                width={media.width}
                height={media.height}
                unavailable={t.unavailable}
              />
            ) : (
              <p role="status">
                {media.status === "pending" ? t.pending : t.unavailable}
              </p>
            )}
          </InvitationSection>
        )}
        {note.enabled && note.body.trim() && (
          <InvitationSection heading={note.heading} label={t.note}>
            <p className={styles.multiline}>{note.body}</p>
          </InvitationSection>
        )}
        {renderRsvp && (
          <InvitationSection heading={copy.rsvpHeading} label={t.rsvp}>
            {copy.rsvpIntro.trim() && <p>{copy.rsvpIntro}</p>}
            {renderRsvp({
              label: copy.rsvpAction.trim() ? copy.rsvpAction : t.rsvp,
              className: styles.action,
            })}
          </InvitationSection>
        )}
        {copy.signoff.trim() && (
          <footer className={styles.footer}>{copy.signoff}</footer>
        )}
      </div>
    </article>
  );
}
