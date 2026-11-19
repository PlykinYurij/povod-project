import type { ReactNode } from "react";
import type { GardenContent, GardenMedia } from "../model/garden-content";
import { GardenOrnament } from "./garden-ornament";
import { GardenEvent } from "./garden-event";
import { GardenProgram } from "./garden-program";
import { GardenPhoto } from "./garden-photo";
import styles from "./garden-invitation.module.css";

export function GardenInvitation({
  content,
  media,
  rsvp,
  idPrefix = "garden",
}: {
  content: GardenContent;
  media?: GardenMedia;
  rsvp?: ReactNode;
  idPrefix?: string;
}) {
  return (
    <article
      lang="ru"
      className={styles.invitation}
      data-palette={content.themeId}
      aria-labelledby={`${idPrefix}-names`}
    >
      <header className={styles.hero}>
        <p className={styles.kicker}>Свадебное приглашение</p>
        <GardenOrnament />
        <h1 id={`${idPrefix}-names`} className={styles.names}>
          <span>{content.names.first.trim() || "Первое имя"}</span>
          <span className={styles.ampersand} aria-hidden="true">
            &
          </span>
          <span className={styles.srOnly}> и </span>
          <span>{content.names.second.trim() || "Второе имя"}</span>
        </h1>
        <p className={styles.introduction}>
          Приглашаем разделить с нами день,
          <br />с которого начинается наша семья.
        </p>
        <span className={styles.heroLine} aria-hidden="true" />
      </header>
      <GardenEvent
        event={content.event}
        venue={content.venue}
        idPrefix={idPrefix}
      />
      <GardenPhoto mediaId={content.heroMediaId} media={media} />
      <GardenProgram program={content.program} idPrefix={idPrefix} />
      {rsvp && (
        <section
          className={styles.response}
          aria-labelledby={`${idPrefix}-rsvp`}
        >
          <p className={styles.kicker}>Будем рады встрече</p>
          <h2 id={`${idPrefix}-rsvp`} className={styles.sectionTitle}>
            Вы с нами?
          </h2>
          {rsvp}
        </section>
      )}
      <footer className={styles.footer}>
        <span aria-hidden="true">✳</span>
        <p>Самые тёплые моменты — вместе.</p>
      </footer>
    </article>
  );
}
