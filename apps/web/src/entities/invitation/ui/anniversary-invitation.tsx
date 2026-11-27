import type { ReactNode } from "react";
import { ConfettiPhoto } from "./confetti-photo";
import type { ConfettiMedia } from "./confetti-invitation";
import styles from "./anniversary-invitation.module.css";

export type AnniversaryMedia = ConfettiMedia;
export type AnniversaryContent = {
  locale: "ru" | "en";
  celebrant: string;
  event: { date: string; startTime: string; timeZone: string };
  venue: { name: string; address: string };
  photo: { alt: string };
  note: { enabled: boolean; text: string };
  copy: {
    eyebrow: string;
    letter: string;
    dateLabel: string;
    placeHeading: string;
    photoHeading: string;
    caption: string;
    noteHeading: string;
    rsvpHeading: string;
    rsvpIntro: string;
    rsvpAction: string;
    signoff: string;
  };
};

const labels = {
  ru: {
    name: "Имя юбиляра",
    date: "Дата",
    place: "Место и время",
    photo: "Фото",
    note: "Заметка",
    rsvp: "Подтверждение участия",
    pending: "Фото обрабатывается",
    unavailable: "Фото недоступно",
  },
  en: {
    name: "Celebrant’s name",
    date: "Date",
    place: "Venue and time",
    photo: "Photo",
    note: "Note",
    rsvp: "RSVP",
    pending: "Photo is processing",
    unavailable: "Photo unavailable",
  },
};

function dateText(value: string, locale: AnniversaryContent["locale"]) {
  const day = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(day.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(day);
}

export function AnniversaryInvitation({
  content,
  media,
  renderRsvp,
}: {
  content: AnniversaryContent;
  media?: AnniversaryMedia;
  renderRsvp?: (options: { label: string; className: string }) => ReactNode;
}) {
  const { celebrant, copy, event, venue, note, photo, locale } = content;
  const t = labels[locale];
  const title = celebrant.trim() || t.name;
  const placeHeading = copy.placeHeading.trim();
  const photoHeading = copy.photoHeading.trim();
  const noteHeading = copy.noteHeading.trim();
  const rsvpHeading = copy.rsvpHeading.trim();
  const rsvpAction = copy.rsvpAction.trim() || t.rsvp;

  return (
    <article className={styles.paper} lang={locale}>
      <header className={styles.hero}>
        <div>
          {copy.eyebrow.trim() && (
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
          )}
          <h1>{title}</h1>
          {copy.letter.trim() && <p className={styles.letter}>{copy.letter}</p>}
        </div>
        {event.date && (
          <aside
            className={styles.date}
            aria-label={copy.dateLabel.trim() || t.date}
          >
            {copy.dateLabel.trim() && <span>{copy.dateLabel}</span>}
            <time dateTime={event.date}>{dateText(event.date, locale)}</time>
          </aside>
        )}
      </header>
      <section className={styles.band} aria-label={placeHeading || t.place}>
        {placeHeading && <h2>{placeHeading}</h2>}
        {venue.name.trim() && <p>{venue.name}</p>}
        {venue.address.trim() && <p>{venue.address}</p>}
        {event.startTime && (
          <p>
            <time dateTime={event.startTime}>{event.startTime}</time>
            {event.timeZone && <small> · {event.timeZone}</small>}
          </p>
        )}
      </section>
      {media && (
        <section className={styles.band} aria-label={photoHeading || t.photo}>
          {photoHeading && <h2>{photoHeading}</h2>}
          {media.status === "ready" ? (
            <figure className={styles.photo}>
              <ConfettiPhoto
                key={media.src}
                src={media.src}
                width={media.width}
                height={media.height}
                alt={photo.alt}
                unavailable={t.unavailable}
              />
              {copy.caption.trim() && <figcaption>{copy.caption}</figcaption>}
            </figure>
          ) : (
            <p role="status">{t[media.status]}</p>
          )}
        </section>
      )}
      {note.enabled && note.text.trim() && (
        <section className={styles.band} aria-label={noteHeading || t.note}>
          {noteHeading && <h2>{noteHeading}</h2>}
          <p className={styles.letter}>{note.text}</p>
        </section>
      )}
      <section className={styles.rsvp} aria-label={rsvpHeading || t.rsvp}>
        {rsvpHeading && <h2>{rsvpHeading}</h2>}
        {copy.rsvpIntro.trim() && <p>{copy.rsvpIntro}</p>}
        {renderRsvp ? (
          renderRsvp({ label: rsvpAction, className: styles.action })
        ) : (
          <button className={styles.action} type="button" disabled>
            {rsvpAction}
          </button>
        )}
      </section>
      {copy.signoff.trim() && (
        <footer className={styles.signoff}>{copy.signoff}</footer>
      )}
    </article>
  );
}
