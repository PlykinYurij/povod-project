import type { GardenContent } from "../model/garden-content";
import { getGardenTranslations } from "@shared/i18n/garden";
import { presentGardenTime } from "../lib/presentation";
import styles from "./garden-invitation.module.css";

export function GardenProgram({
  program,
  copy,
  locale,
  idPrefix,
}: Pick<GardenContent, "program" | "copy" | "locale"> & { idPrefix: string }) {
  const t = getGardenTranslations(locale);
  if (!program?.length) return null;
  return (
    <section className={styles.section} aria-labelledby={`${idPrefix}-program`}>
      <p className={styles.kicker}>{copy.programEyebrow}</p>
      <h2 id={`${idPrefix}-program`} className={styles.sectionTitle}>
        {copy.programTitle}
      </h2>
      <ol className={styles.program}>
        {program.map((item, index) => {
          const time = presentGardenTime(item.time);
          return (
            <li key={index} className={styles.programItem}>
              {time ? (
                <time dateTime={item.time}>{time}</time>
              ) : (
                <span>{t("missingProgramTime")}</span>
              )}
              <span>{item.text.trim() || t("missingProgramText")}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
