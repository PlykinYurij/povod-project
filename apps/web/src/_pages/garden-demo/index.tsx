import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GardenInvitation } from "@entities/invitation";
import { getGardenTranslations } from "@shared/i18n/garden";
import { gardenDemoMedia, selectGardenDemo } from "./model/demo-content";
import styles from "./demo.module.css";

export async function GardenDemoPage({
  palette,
  sample,
}: {
  palette?: unknown;
  sample?: unknown;
}) {
  const t = await getTranslations("TemplateDemo");
  const content = selectGardenDemo(palette, sample);
  const invitation = getGardenTranslations(content.locale);
  const selectedSample =
    typeof sample === "string" &&
    ["minimal", "empty", "media-pending"].includes(sample)
      ? sample
      : "full";
  return (
    <main className={styles.page}>
      <header className={styles.toolbar}>
        <Link href="/" className={styles.back}>
          {t("back")}
        </Link>
        <p className={styles.title}>{t("title")}</p>
        <form
          method="get"
          className={styles.controls}
          aria-label={t("controls")}
        >
          <label>
            {t("palette")}
            <select name="palette" defaultValue={content.themeId}>
              <option value="sage">{t("sage")}</option>
              <option value="sand">{t("sand")}</option>
            </select>
          </label>
          <label>
            {t("sample")}
            <select name="sample" defaultValue={selectedSample}>
              <option value="full">{t("full")}</option>
              <option value="minimal">{t("minimal")}</option>
              <option value="empty">{t("empty")}</option>
              <option value="media-pending">{t("mediaPending")}</option>
            </select>
          </label>
          <button type="submit">{t("apply")}</button>
        </form>
        <p className={styles.notice}>{t("notice")}</p>
      </header>
      <div className={styles.canvas}>
        <GardenInvitation
          content={content}
          media={gardenDemoMedia}
          rsvp={<p>{invitation("demoResponseNotice")}</p>}
        />
      </div>
      <footer className={styles.footer}>
        <p>{t("next")}</p>
        <Link href="/account">{t("account")}</Link>
      </footer>
    </main>
  );
}
