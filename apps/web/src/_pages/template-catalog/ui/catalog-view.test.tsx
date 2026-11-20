// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { templateCatalogFixture } from "@shared/lib/testing/template-catalog-fixture";
import ru from "@shared/i18n/ru.json";
import en from "@shared/i18n/en.json";
import { CatalogView } from "./catalog-view";

afterEach(cleanup);
test("catalog renders API labels and a local demo link without pretending to create projects", () => {
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
  expect(document.querySelector("form")).toBeNull();
  expect(screen.queryByRole("button", { name: /создать/i })).toBeNull();
});
test("empty catalog has its own state", () => {
  render(
    <CatalogView
      state={{ kind: "ready", items: [] }}
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
