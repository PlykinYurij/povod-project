import type { GardenContent } from "../model/garden-content";
import { getGardenTranslations } from "@shared/i18n/garden";
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
  copy,
  locale,
  idPrefix,
}: Pick<GardenContent, "event" | "venue" | "copy" | "locale"> & {
  idPrefix: string;
}) {
  const t = getGardenTranslations(locale);
  const date = presentGardenDate(event.localDate, locale);
  const time = presentGardenTime(event.localTime);
  const zone = presentGardenTimeZone(event.timeZone);
  const route = safeGardenRoute(venue.routeUrl);
  return (
    <section className={styles.details} aria-labelledby={`${idPrefix}-details`}>
      <h2 id={`${idPrefix}-details`} className={styles.sectionTitle}>
        {copy.detailsTitle}
      </h2>
      <div className={styles.detailGrid}>
        <div>
          <p className={styles.kicker}>{copy.whenLabel}</p>
          <p className={styles.detailTitle}>
            {date ? (
              <time dateTime={event.localDate}>{date}</time>
            ) : (
              t("missingDate")
            )}
          </p>
          <p>
            {time ? (
              <>
                {copy.startTimeLabel}{" "}
                <time dateTime={event.localTime}>{time}</time>
              </>
            ) : (
              t("missingTime")
            )}
          </p>
          <p className={styles.small}>
            {zone ? (
              <>
                {copy.timeZoneLabel}: {zone}
              </>
            ) : (
              t("missingTimeZone")
            )}
          </p>
        </div>
        <div>
          <p className={styles.kicker}>{copy.whereLabel}</p>
          <p className={styles.detailTitle}>
            {venue.name.trim() || t("missingVenueName")}
          </p>
          <p className={styles.address}>
            {venue.address.trim() || t("missingVenueAddress")}
          </p>
          {route && (
            <a
              className={styles.link}
              href={route}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.routeLabel}
              <span className={styles.srOnly}>{t("newTab")}</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
