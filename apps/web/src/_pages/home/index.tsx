import Link from "next/link";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "../../shared/config/locale";
import { ACCOUNT_ROUTE } from "../../shared/config/auth-navigation";
import styles from "./home.module.css";

export async function HomePage() {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const { Home: text } = (await import(`../../shared/i18n/${locale}.json`))
    .default;
  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-labelledby="page-title">
        <p className={styles.eyebrow}>{text.eyebrow}</p>
        <h1 id="page-title" className={styles.title}>
          {text.title}
        </h1>
        <p className={styles.description}>{text.description}</p>
        <p className={styles.detail}>{text.detail}</p>
        <div className={styles.actions}>
          <Link href={ACCOUNT_ROUTE} className={styles.action}>
            {text.action}
          </Link>
          <p className={styles.hint}>{text.hint}</p>
        </div>
        <p className={styles.notice}>{text.notice}</p>
      </section>
      <footer className={styles.footer}>{text.footer}</footer>
    </main>
  );
}
