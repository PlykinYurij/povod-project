import { expect, test } from "vitest";
import { templateCatalogFixture } from "@shared/lib/testing/template-catalog-fixture";
import { isTemplateCatalog } from "./catalog-validation";

test("empty and complete catalogs satisfy the generated response shape", () => {
  expect(isTemplateCatalog({ items: [], categories: [] })).toBe(true);
  expect(isTemplateCatalog(templateCatalogFixture())).toBe(true);
});

test("birthday invitations remain visible alongside wedding invitations", () => {
  const catalog = templateCatalogFixture();
  catalog.categories.push({ id: "birthday", title: "День рождения" });
  catalog.items.push({
    ...catalog.items[0],
    templateId: "confetti",
    templateVersionId: "birthday-confetti-v1",
    categoryId: "birthday",
    eventType: "birthday",
    demoPath: "/templates/confetti",
    previewImagePath: "/templates/confetti/cover.svg",
    blocks: [{ id: "celebrant-name", required: true }],
  });
  expect(isTemplateCatalog(catalog)).toBe(true);
  expect(isTemplateCatalog({
    ...catalog,
    items: [{ ...catalog.items[1], eventType: "unsupported" }],
  })).toBe(false);
});
test.each([null, {}, { items: [null] }, { items: "wrong" }])(
  "malformed catalogs cannot reach the UI",
  (value) => {
    expect(isTemplateCatalog(value)).toBe(false);
  },
);
test.each([
  "javascript:alert(1)",
  "https://example.test/templates/quiet-garden",
  "//example.test/demo",
  "/templates/../account",
])("demo href is constrained to a local template path: %s", (path) => {
  const fixture = templateCatalogFixture();
  fixture.items[0].demoPath = path;
  expect(isTemplateCatalog(fixture)).toBe(false);
});
test("arbitrary media URLs, duplicate keys and invalid nested values are rejected", () => {
  const image = templateCatalogFixture();
  image.items[0].previewImagePath = "data:image/svg+xml,unsafe";
  expect(isTemplateCatalog(image)).toBe(false);
  const duplicate = templateCatalogFixture();
  duplicate.items.push({ ...duplicate.items[0] });
  expect(isTemplateCatalog(duplicate)).toBe(false);
  const nested = {
    ...templateCatalogFixture(),
    items: [
      {
        ...templateCatalogFixture().items[0],
        themes: [{ id: "sage", title: 123 }],
      },
    ],
  };
  expect(isTemplateCatalog(nested)).toBe(false);
});

test("price fields and category relationship are checked before display", () => {
  const priced = templateCatalogFixture();
  priced.items[0].price = { amountMinor: 123456, currency: "RUB", version: 2 };
  expect(isTemplateCatalog(priced)).toBe(true);
  const negative = structuredClone(priced);
  negative.items[0].price!.amountMinor = -1;
  expect(isTemplateCatalog(negative)).toBe(false);
  const fractional = structuredClone(priced);
  fractional.items[0].price!.amountMinor = 1.5;
  expect(isTemplateCatalog(fractional)).toBe(false);
  const missing = templateCatalogFixture();
  missing.categories = [];
  expect(isTemplateCatalog(missing)).toBe(false);
});
