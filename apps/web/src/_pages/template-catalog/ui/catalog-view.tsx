import Link from "next/link";
import type messages from "@shared/i18n/ru.json";
import type { Locale } from "@shared/config/locale";
import type { CatalogState } from "@entities/template/server";
import { newProjectHref } from "@shared/config/project-navigation";
import styles from "../catalog.module.css";

export type CatalogLabels = typeof messages.TemplateCatalog;

export function CatalogView({
  state,
  labels,
  locale = "ru",
  category,
}: {
  state: CatalogState;
  labels: CatalogLabels;
  locale?: Locale;
  category?: string;
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
      {state.kind === "ready" && (
        <nav className={styles.filters} aria-label={labels.categories}>
          <Link href="/templates" aria-current={!category ? "page" : undefined}>
            {labels.allCategories}
          </Link>
          {state.categories.map(({ id, title }) => (
            <Link
              key={id}
              href={`/templates?${new URLSearchParams({ category: id })}`}
              aria-current={category === id ? "page" : undefined}
            >
              {title}
            </Link>
          ))}
        </nav>
      )}
      <CatalogContent
        state={state}
        labels={labels}
        locale={locale}
        category={category}
      />
    </main>
  );
}

function CatalogContent({
  state,
  labels,
  locale,
  category,
}: {
  state: CatalogState;
  labels: CatalogLabels;
  locale: Locale;
  category?: string;
}) {
  if (state.kind === "unavailable")
    return (
      <section className={styles.message} role="alert">
        <h2>{labels.errorTitle}</h2>
        <p>{labels.errorDescription}</p>
        <a
          href={
            category
              ? `/templates?${new URLSearchParams({ category })}`
              : "/templates"
          }
          className={styles.action}
        >
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
            <div className={styles.actions}>
              <Link
                href={newProjectHref(template.templateVersionId)}
                className={styles.action}
              >
                {labels.choose}
                <span className={styles.srOnly}>: {template.title}</span>
              </Link>
              <Link href={template.demoPath}>
                {labels.demo}
                <span className={styles.srOnly}>: {template.title}</span>
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
