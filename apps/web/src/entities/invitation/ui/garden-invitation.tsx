import type { ReactNode } from "react";
import type { GardenContent, GardenMedia } from "../model/garden-content";
import { getGardenTranslations } from "@shared/i18n/garden";
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
  const t = getGardenTranslations(content.locale);
  const { copy } = content;
  return (
    <article
      lang={content.locale}
      className={styles.invitation}
      data-palette={content.themeId}
      aria-labelledby={`${idPrefix}-names`}
    >
      <header className={styles.hero}>
        <p className={styles.kicker}>{copy.invitationLabel}</p>
        <GardenOrnament />
        <h1 id={`${idPrefix}-names`} className={styles.names}>
          <span>{content.names.first.trim() || t("firstNamePlaceholder")}</span>
          <span className={styles.ampersand}>{copy.namesConnector}</span>
          <span>
            {content.names.second.trim() || t("secondNamePlaceholder")}
          </span>
        </h1>
        <p className={styles.introduction}>{copy.introduction}</p>
        <span className={styles.heroLine} aria-hidden="true" />
      </header>
      <GardenEvent
        event={content.event}
        venue={content.venue}
        copy={copy}
        locale={content.locale}
        idPrefix={idPrefix}
      />
      <GardenPhoto
        mediaId={content.heroMediaId}
        media={media}
        locale={content.locale}
      />
      <GardenProgram
        program={content.program}
        copy={copy}
        locale={content.locale}
        idPrefix={idPrefix}
      />
      {rsvp && (
        <section
          className={styles.response}
          aria-labelledby={`${idPrefix}-rsvp`}
        >
          <p className={styles.kicker}>{copy.rsvpEyebrow}</p>
          <h2 id={`${idPrefix}-rsvp`} className={styles.sectionTitle}>
            {copy.rsvpTitle}
          </h2>
          {rsvp}
        </section>
      )}
      <footer className={styles.footer}>
        <span aria-hidden="true">✳</span>
        <p>{copy.footerText}</p>
      </footer>
    </article>
  );
}
