import Link from "next/link";
import type messages from "@shared/i18n/ru.json";
import type { Locale } from "@shared/config/locale";
import type { CatalogState } from "../model/load-catalog";
import styles from "../catalog.module.css";

export type CatalogLabels = typeof messages.TemplateCatalog;

export function CatalogView({
  state,
  labels,
  locale = "ru",
}: {
  state: CatalogState;
  labels: CatalogLabels;
  locale?: Locale;
}) {
  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label={labels.navigation}>
        <Link href="/">{labels.home}</Link>
        <Link href="/account">{labels.account}</Link>
      </nav>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{labels.eyebrow}</p>
        <h1>{labels.title}</h1>
        <p>{labels.intro}</p>
      </header>
      <CatalogContent state={state} labels={labels} locale={locale} />
    </main>
  );
}

function CatalogContent({
  state,
  labels,
  locale,
}: {
  state: CatalogState;
  labels: CatalogLabels;
  locale: Locale;
}) {
  if (state.kind === "unavailable")
    return (
      <section className={styles.message} role="alert">
        <h2>{labels.errorTitle}</h2>
        <p>{labels.errorDescription}</p>
        <a href="/templates" className={styles.action}>
          {labels.retry}
        </a>
      </section>
    );
  if (state.items.length === 0)
    return (
      <section className={styles.message} role="status">
        <h2>{labels.emptyTitle}</h2>
        <p>{labels.emptyDescription}</p>
      </section>
    );
  const categoryTitles = new Map(
    state.categories.map((category) => [category.id, category.title]),
  );
  return (
    <ul className={styles.grid}>
      {state.items.map((template) => (
        <li key={template.templateVersionId} className={styles.card}>
          <Link
            href={template.demoPath}
            className={styles.preview}
            tabIndex={-1}
            aria-hidden="true"
          >
            <img
              src={template.previewImagePath}
              alt=""
              width={960}
              height={720}
            />
          </Link>
          <div className={styles.cardBody}>
            <p className={styles.eyebrow}>
              {categoryTitles.get(template.categoryId)}
            </p>
            <h2>{template.title}</h2>
            <p>{labels.description}</p>
            <p>
              {template.price === null
                ? labels.pricePending
                : new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency: template.price.currency,
                  }).format(template.price.amountMinor / 100)}
            </p>
            <p className={styles.themes}>
              <span>{labels.palettes}</span>{" "}
              {template.themes.map((theme) => theme.title).join(" · ")}
            </p>
            <Link href={template.demoPath} className={styles.action}>
              {labels.demo}
              <span className={styles.srOnly}>: {template.title}</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
