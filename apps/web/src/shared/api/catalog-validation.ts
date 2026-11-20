import type { TemplateCatalogDto } from "./generated/models";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
function uniqueIds(values: { id: string }[]) {
  return new Set(values.map((value) => value.id)).size === values.length;
}

/** Verify untrusted response/link fields before rendering public navigation or images. */
export function isTemplateCatalog(value: unknown): value is TemplateCatalogDto {
  if (!object(value) || !Array.isArray(value.items)) return false;
  const items = value.items;
  const valid = items.every(
    (item) =>
      object(item) &&
      identifier(item.templateVersionId) &&
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
