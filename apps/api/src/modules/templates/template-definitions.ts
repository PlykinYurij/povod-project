import type { TemplateVersion } from "../../database/generated/client";
import type { TemplateSummaryDto } from "./template-catalog.dto";

const palettes = {
  ru: [
    { id: "sage", title: "Шалфей" },
    { id: "sand", title: "Тёплый песок" },
  ],
  en: [
    { id: "sage", title: "Sage" },
    { id: "sand", title: "Warm sand" },
  ],
};

/** Only code shipped with a validator, defaults and renderer may enter the catalog. */
export function registeredTemplate(
  version: Pick<
    TemplateVersion,
    "id" | "templateId" | "schemaVersion" | "rendererKey" | "defaultsVersion"
  >,
) {
  return (
    version.id === "wedding-garden-v1" &&
    version.templateId === "quiet-garden" &&
    version.schemaVersion === 1 &&
    version.rendererKey === "garden-v1" &&
    version.defaultsVersion === 1
  );
}

export function gardenMetadata(
  locale: "ru" | "en",
): Pick<
  TemplateSummaryDto,
  "eventType" | "themes" | "blocks" | "demoPath" | "previewImagePath"
> {
  return {
    eventType: "wedding",
    themes: palettes[locale].map((palette) => ({ ...palette })),
    blocks: [
      { id: "names", required: true },
      { id: "event", required: true },
      { id: "venue", required: true },
      { id: "photo", required: false },
      { id: "program", required: false },
      { id: "rsvp", required: true },
    ],
    demoPath: "/templates/quiet-garden",
    previewImagePath: "/templates/quiet-garden/garden.svg",
  };
}
