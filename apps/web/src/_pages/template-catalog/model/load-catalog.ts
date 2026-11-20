import {
  getTemplateCatalog,
  type TemplateSummaryDto,
  type TemplateCategoryDto,
} from "@shared/api/server";
import type { Locale } from "@shared/config/locale";

export type CatalogState =
  | {
      kind: "ready";
      items: TemplateSummaryDto[];
      categories: TemplateCategoryDto[];
    }
  | { kind: "unavailable" };

export async function loadCatalog(locale: Locale): Promise<CatalogState> {
  try {
    const response = await getTemplateCatalog(
      { locale },
      { signal: AbortSignal.timeout(5_000) },
    );
    return {
      kind: "ready",
      items: response.items,
      categories: response.categories,
    };
  } catch {
    // Network/timeout/invalid payload are not an empty catalog and never expose backend internals.
    return { kind: "unavailable" };
  }
}
