import type { TemplateCatalogDto, TemplatePriceDto } from "./generated/models";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
function uniqueIds(values: { id: string }[]) {
  return new Set(values.map((value) => value.id)).size === values.length;
}

export function isTemplatePrice(
  value: unknown,
): value is TemplatePriceDto | null {
  return (
    value === null ||
    (object(value) &&
      value.currency === "RUB" &&
      typeof value.amountMinor === "number" &&
      Number.isInteger(value.amountMinor) &&
      value.amountMinor >= 0 &&
      value.amountMinor <= 2147483647 &&
      typeof value.version === "number" &&
      Number.isSafeInteger(value.version) &&
      value.version > 0)
  );
}

/** Verify untrusted response/link fields before rendering public navigation or images. */
export function isTemplateCatalog(value: unknown): value is TemplateCatalogDto {
  if (
    !object(value) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.categories)
  )
    return false;
  const categories = value.categories;
  if (
    !categories.every(
      (category) =>
        object(category) &&
        identifier(category.id) &&
        typeof category.title === "string" &&
        category.title.trim().length > 0,
    ) ||
    !uniqueIds(categories)
  )
    return false;
  const categoryIds = new Set(categories.map((category) => category.id));
  const items = value.items;
  const valid = items.every(
    (item) =>
      object(item) &&
      identifier(item.templateVersionId) &&
      identifier(item.templateId) &&
      identifier(item.categoryId) &&
      categoryIds.has(item.categoryId) &&
      isTemplatePrice(item.price) &&
      typeof item.title === "string" &&
      item.title.trim().length > 0 &&
      item.eventType === "wedding" &&
      typeof item.schemaVersion === "number" &&
      Number.isInteger(item.schemaVersion) &&
      item.schemaVersion > 0 &&
      typeof item.demoPath === "string" &&
      /^\/templates\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.demoPath) &&
      typeof item.previewImagePath === "string" &&
      /^\/templates\/[a-z0-9-]+\/[a-z0-9-]+\.(?:svg|webp|png|jpg)$/.test(
        item.previewImagePath,
      ) &&
      Array.isArray(item.themes) &&
      item.themes.every(
        (theme) =>
          object(theme) &&
          identifier(theme.id) &&
          typeof theme.title === "string",
      ) &&
      uniqueIds(item.themes) &&
      Array.isArray(item.blocks) &&
      item.blocks.every(
        (block) =>
          object(block) &&
          identifier(block.id) &&
          typeof block.required === "boolean",
      ) &&
      uniqueIds(item.blocks),
  );
  return (
    valid &&
    new Set(items.map((item) => item.templateVersionId)).size === items.length
  );
}
