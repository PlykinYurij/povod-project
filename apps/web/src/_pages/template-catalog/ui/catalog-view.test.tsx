// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { templateCatalogFixture } from "@shared/lib/testing/template-catalog-fixture";
import ru from "@shared/i18n/ru.json";
import en from "@shared/i18n/en.json";
import { CatalogView } from "./catalog-view";

afterEach(cleanup);

test("unconfigured price is never displayed as free", () => {
  render(
    <CatalogView
      state={{ kind: "ready", ...templateCatalogFixture() }}
      labels={en.TemplateCatalog}
      locale="en"
    />,
  );
  expect(screen.getByText(en.TemplateCatalog.pricePending)).toBeTruthy();
  expect(screen.queryByText(/free/i)).toBeNull();
});

test("configured price uses integer minor units and the display locale", () => {
  const fixture = templateCatalogFixture();
  fixture.items[0].price = { amountMinor: 123456, currency: "RUB", version: 1 };
  render(
    <CatalogView
      state={{ kind: "ready", ...fixture }}
      labels={ru.TemplateCatalog}
      locale="ru"
    />,
  );
  expect(screen.getByText(/1\s?234,56\s?₽/)).toBeTruthy();
  expect(screen.queryByText(ru.TemplateCatalog.pricePending)).toBeNull();
});
test("catalog links to the selected version without creating a draft on navigation", () => {
  render(
    <CatalogView
      state={{ kind: "ready", ...templateCatalogFixture() }}
      labels={ru.TemplateCatalog}
    />,
  );
  expect(screen.getByRole("heading", { name: "Тихий сад" })).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Посмотреть демо: Тихий сад" })
      .getAttribute("href"),
  ).toBe("/templates/quiet-garden");
  expect(
    screen
      .getByRole("link", { name: "Выбрать шаблон: Тихий сад" })
      .getAttribute("href"),
  ).toBe("/projects/new?templateVersionId=wedding-garden-v1");
  expect(document.querySelector("form")).toBeNull();
  expect(screen.queryByRole("button", { name: /создать/i })).toBeNull();
});

test("empty category keeps filters available and marks the selected category", () => {
  const { categories } = templateCatalogFixture();
  render(
    <CatalogView
      state={{ kind: "ready", items: [], categories }}
      labels={ru.TemplateCatalog}
      category={categories[0].id}
    />,
  );
  expect(
    screen
      .getByRole("link", { name: categories[0].title })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen
      .getByRole("link", { name: ru.TemplateCatalog.allCategories })
      .getAttribute("href"),
  ).toBe("/templates");
  expect(screen.getByRole("status")).toBeTruthy();
});
test("empty catalog has its own state", () => {
  render(
    <CatalogView
      state={{ kind: "ready", items: [], categories: [] }}
      labels={ru.TemplateCatalog}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain(
    ru.TemplateCatalog.emptyTitle,
  );
  expect(screen.queryByRole("alert")).toBeNull();
});
test("unavailable API offers a full reload and does not leak diagnostics", () => {
  render(
    <CatalogView state={{ kind: "unavailable" }} labels={en.TemplateCatalog} />,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    en.TemplateCatalog.errorTitle,
  );
  expect(
    screen
      .getByRole("link", { name: en.TemplateCatalog.retry })
      .getAttribute("href"),
  ).toBe("/templates");
  expect(screen.queryByRole("status")).toBeNull();
});
test("untrusted text is escaped in server markup without requiring client providers", () => {
  const fixture = templateCatalogFixture();
  fixture.items[0].title = "<script>owner</script>";
  const html = renderToStaticMarkup(
    <CatalogView
      state={{ kind: "ready", ...fixture }}
      labels={ru.TemplateCatalog}
    />,
  );
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("mantine-");
});
