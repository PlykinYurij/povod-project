import { getLocale, getTranslations } from "next-intl/server";
import { parseLocale } from "@shared/config/locale";
import { loadCatalog } from "./model/load-catalog";
import { CatalogView, type CatalogLabels } from "./ui/catalog-view";
export { TemplateCatalogLoading } from "./ui/catalog-loading";

export async function TemplateCatalogPage() {
  const locale = parseLocale(await getLocale());
  const t = await getTranslations("TemplateCatalog");
  const labels: CatalogLabels = {
    navigation: t("navigation"),
    home: t("home"),
    account: t("account"),
    eyebrow: t("eyebrow"),
    title: t("title"),
    intro: t("intro"),
    errorTitle: t("errorTitle"),
    errorDescription: t("errorDescription"),
    retry: t("retry"),
    emptyTitle: t("emptyTitle"),
    emptyDescription: t("emptyDescription"),
    wedding: t("wedding"),
    description: t("description"),
    palettes: t("palettes"),
    demo: t("demo"),
    loading: t("loading"),
    pricePending: t("pricePending"),
  };
  return (
    <CatalogView
      state={await loadCatalog(locale)}
      labels={labels}
      locale={locale}
    />
  );
}
