import { expect, test } from "vitest";
import { templateCatalogFixture } from "@shared/lib/testing/template-catalog-fixture";
import { isTemplateCatalog } from "./catalog-validation";

test("empty and complete catalogs satisfy the generated response shape", () => {
  expect(isTemplateCatalog({ items: [] })).toBe(true);
  expect(isTemplateCatalog(templateCatalogFixture())).toBe(true);
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
    items: [
      {
        ...templateCatalogFixture().items[0],
        themes: [{ id: "sage", title: 123 }],
      },
    ],
  };
  expect(isTemplateCatalog(nested)).toBe(false);
});
