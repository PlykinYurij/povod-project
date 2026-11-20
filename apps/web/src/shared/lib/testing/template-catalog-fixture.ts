import type { TemplateCatalogDto } from "@shared/api/generated/models";

/** Synthetic UI/transport fixture using generated DTOs; not a replacement for API HTTP tests. */
export function templateCatalogFixture(): TemplateCatalogDto {
  return {
    items: [
      {
        templateVersionId: "wedding-garden-v1",
        title: "Тихий сад",
        eventType: "wedding",
        schemaVersion: 1,
        themes: [
          { id: "sage", title: "Шалфей" },
          { id: "sand", title: "Тёплый песок" },
        ],
        blocks: [
          { id: "names", required: true },
          { id: "program", required: false },
          { id: "rsvp", required: true },
        ],
        demoPath: "/templates/quiet-garden",
        previewImagePath: "/templates/quiet-garden/garden.svg",
      },
    ],
  };
}
