import type { ReactNode } from "react";
import { ConfettiPhoto } from "./confetti-photo";
import styles from "./confetti-invitation.module.css";

export type ConfettiContent = {
  locale: "ru" | "en";
  celebrantName: string;
  event: { date: string; startTime: string; timeZone: string };
  venue: { name: string; address: string };
  photo: { alt: string };
  note: { enabled: boolean; heading: string; body: string };
  copy: {
    invitationLabel: string;
    intro: string;
    whenHeading: string;
    whereHeading: string;
    dateLabel: string;
    timeLabel: string;
    photoHeading: string;
    rsvpHeading: string;
    rsvpIntro: string;
    rsvpAction: string;
    signoff: string;
  };
};

export type ConfettiMedia =
  | { status: "pending" | "unavailable" }
  | { status: "ready"; src: string; width: number; height: number };

const messages = {
  ru: {
    name: "Имя именинника",
    when: "Дата и время",
    where: "Место",
    photo: "Фото",
    note: "Заметка",
    rsvp: "Подтверждение участия",
    pending: "Фото обрабатывается",
    unavailable: "Фото недоступно",
  },
  en: {
    name: "Celebrant’s name",
    when: "Date and time",
    where: "Venue",
    photo: "Photo",
    note: "Note",
    rsvp: "RSVP",
    pending: "Photo is processing",
    unavailable: "Photo unavailable",
  },
};

function formatDate(date: string, locale: ConfettiContent["locale"]) {
  const day = new Date(date + "T00:00:00Z");
  return Number.isNaN(day.getTime())
    ? date
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(day);
}

export function ConfettiInvitation({
  content,
  media,
  renderRsvp,
}: {
  content: ConfettiContent;
  media?: ConfettiMedia;
  renderRsvp?: (options: { label: string; className: string }) => ReactNode;
}) {
  const { celebrantName, copy, event, venue, note, photo, locale } = content;
  const t = messages[locale];
  const whenHeading = copy.whenHeading.trim();
  const whereHeading = copy.whereHeading.trim();
  const photoHeading = copy.photoHeading.trim();
  const noteHeading = note.heading.trim();
  const rsvpHeading = copy.rsvpHeading.trim();
  const rsvpAction = copy.rsvpAction.trim() || t.rsvp;
  return (
    <article className={styles.invitation} lang={locale}>
      <header className={styles.hero}>
        <div>
          {copy.invitationLabel && (
            <p className={styles.label}>{copy.invitationLabel}</p>
          )}
          <h1>{celebrantName.trim() || t.name}</h1>
          {copy.intro && <p>{copy.intro}</p>}
        </div>
        <div className={styles.stamp} aria-hidden="true">
          <span />
        </div>
      </header>
      <div className={styles.details}>
        <section
          className={styles.tile}
          aria-label={whenHeading || t.when}
        >
          {whenHeading && <h2>{whenHeading}</h2>}
          {event.date && (
            <p>
              {copy.dateLabel && <strong>{copy.dateLabel} </strong>}
              <time dateTime={event.date}>
                {formatDate(event.date, locale)}
              </time>
            </p>
          )}
          {event.startTime && (
            <p>
              {copy.timeLabel && <strong>{copy.timeLabel} </strong>}
              <time dateTime={event.startTime}>{event.startTime}</time>
              {event.timeZone && <small> · {event.timeZone}</small>}
            </p>
          )}
        </section>
        <section
          className={styles.tile}
          aria-label={whereHeading || t.where}
        >
          {whereHeading && <h2>{whereHeading}</h2>}
          {venue.name && <p>{venue.name}</p>}
          {venue.address && <p>{venue.address}</p>}
        </section>
      </div>
      {media && (
        <section
          className={styles.tile}
          aria-label={photoHeading || t.photo}
        >
          {photoHeading && <h2>{photoHeading}</h2>}
          {media.status === "ready" ? (
            <ConfettiPhoto
              key={media.src}
              src={media.src}
              width={media.width}
              height={media.height}
              alt={photo.alt}
              unavailable={t.unavailable}
            />
          ) : (
            <p role="status">{t[media.status]}</p>
          )}
        </section>
      )}
      {note.enabled && note.body.trim() && (
        <section className={styles.tile} aria-label={noteHeading || t.note}>
          {noteHeading && <h2>{noteHeading}</h2>}
          <p>{note.body}</p>
        </section>
      )}
      <section className={styles.rsvp} aria-label={rsvpHeading || t.rsvp}>
        {rsvpHeading && <h2>{rsvpHeading}</h2>}
        {copy.rsvpIntro && <p>{copy.rsvpIntro}</p>}
        {renderRsvp ? (
          renderRsvp({ label: rsvpAction, className: styles.action })
        ) : (
          <button disabled type="button" className={styles.action}>
            {rsvpAction}
          </button>
        )}
      </section>
      {copy.signoff.trim() && <footer>{copy.signoff}</footer>}
    </article>
  );
}
