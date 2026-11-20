import { getTranslations } from "next-intl/server";
import styles from "../catalog.module.css";

export async function TemplateCatalogLoading() {
  const t = await getTranslations("TemplateCatalog");
  return (
    <main className={styles.page}>
      <p role="status" aria-live="polite">
        {t("loading")}
      </p>
    </main>
  );
}
