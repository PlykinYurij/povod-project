import type { GardenContent } from "../model/garden-content";
import {
  presentGardenDate,
  presentGardenTime,
  presentGardenTimeZone,
  safeGardenRoute,
} from "../lib/presentation";
import styles from "./garden-invitation.module.css";

export function GardenEvent({
  event,
  venue,
  idPrefix,
}: Pick<GardenContent, "event" | "venue"> & { idPrefix: string }) {
  const date = presentGardenDate(event.localDate);
  const time = presentGardenTime(event.localTime);
  const zone = presentGardenTimeZone(event.timeZone);
  const route = safeGardenRoute(venue.routeUrl);
  return (
    <section className={styles.details} aria-labelledby={`${idPrefix}-details`}>
      <h2 id={`${idPrefix}-details`} className={styles.sectionTitle}>
        День, который нас объединит
      </h2>
      <div className={styles.detailGrid}>
        <div>
          <p className={styles.kicker}>Когда</p>
          <p className={styles.detailTitle}>
            {date ? (
              <time dateTime={event.localDate}>{date}</time>
            ) : (
              "Дата ещё не указана"
            )}
          </p>
          <p>
            {time ? (
              <>
                Начало в <time dateTime={event.localTime}>{time}</time>
              </>
            ) : (
              "Время ещё не указано"
            )}
          </p>
          <p className={styles.small}>
            {zone ? `Часовой пояс: ${zone}` : "Часовой пояс ещё не указан"}
          </p>
        </div>
        <div>
          <p className={styles.kicker}>Где</p>
          <p className={styles.detailTitle}>
            {venue.name.trim() || "Название места ещё не указано"}
          </p>
          <p className={styles.address}>
            {venue.address.trim() || "Адрес ещё не указан"}
          </p>
          {route && (
            <a
              className={styles.link}
              href={route}
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть маршрут
              <span className={styles.srOnly}> (в новой вкладке)</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
