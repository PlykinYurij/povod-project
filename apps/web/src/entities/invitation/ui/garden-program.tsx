import type { GardenContent } from "../model/garden-content";
import { presentGardenTime } from "../lib/presentation";
import styles from "./garden-invitation.module.css";

export function GardenProgram({
  program,
  idPrefix,
}: Pick<GardenContent, "program"> & { idPrefix: string }) {
  if (!program?.length) return null;
  return (
    <section className={styles.section} aria-labelledby={`${idPrefix}-program`}>
      <p className={styles.kicker}>Всё самое важное</p>
      <h2 id={`${idPrefix}-program`} className={styles.sectionTitle}>
        Этот день вместе
      </h2>
      <ol className={styles.program}>
        {program.map((item, index) => {
          const time = presentGardenTime(item.time);
          return (
            <li key={index} className={styles.programItem}>
              {time ? (
                <time dateTime={item.time}>{time}</time>
              ) : (
                <span>Время уточняется</span>
              )}
              <span>
                {item.text.trim() || "Название пункта ещё не указано"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
