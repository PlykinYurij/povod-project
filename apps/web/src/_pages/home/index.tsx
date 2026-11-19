import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ACCOUNT_ROUTE } from "@shared/config/auth-navigation";
import styles from "./home.module.css";

export async function HomePage() {
  const t = await getTranslations("Home");
  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-labelledby="page-title">
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1 id="page-title" className={styles.title}>
          {t("title")}
        </h1>
        <p className={styles.description}>{t("description")}</p>
        <p className={styles.detail}>{t("detail")}</p>
        <div className={styles.actions}>
          <Link href={ACCOUNT_ROUTE} className={styles.action}>
            {t("action")}
          </Link>
          <p className={styles.hint}>{t("hint")}</p>
        </div>
        <p className={styles.notice}>{t("notice")}</p>
      </section>
      <footer className={styles.footer}>{t("footer")}</footer>
    </main>
  );
}
