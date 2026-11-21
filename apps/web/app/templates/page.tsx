import type { Metadata } from "next";
import { TemplateCatalogPage } from "@pages/template-catalog";

export const metadata: Metadata = {
  title: "Шаблоны приглашений | Повод",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { category } = await searchParams;
  const validCategory =
    typeof category === "string" &&
    category.length <= 64 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category);
  return (
    <TemplateCatalogPage category={validCategory ? category : undefined} />
  );
}
