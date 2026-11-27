import type { TemplateVersion } from "../../database/generated/client";
import type { TemplateSummaryDto } from "./template-catalog.dto";
import { CONFETTI_TEMPLATE_VERSION_ID } from "./confetti/confetti-content.dto";
import { ANNIVERSARY_TEMPLATE_VERSION_ID } from "./anniversary/anniversary-content.dto";

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
    version.schemaVersion === 1 &&
    version.defaultsVersion === 1 &&
    ((version.id === "wedding-garden-v1" &&
      version.templateId === "quiet-garden" &&
      version.rendererKey === "garden-v1") ||
      (version.id === "wedding-together-v1" &&
        version.templateId === "vdvoem" &&
        version.rendererKey === "together-v1") ||
      (version.id === CONFETTI_TEMPLATE_VERSION_ID &&
        version.templateId === "confetti" &&
        version.rendererKey === "confetti-v1") ||
      (version.id === ANNIVERSARY_TEMPLATE_VERSION_ID &&
        version.templateId === "anniversary" &&
        version.rendererKey === "anniversary-v1"))
  );
}

export function templateMetadata(
  version: string,
  locale: "ru" | "en",
): Pick<
  TemplateSummaryDto,
  "eventType" | "themes" | "blocks" | "demoPath" | "previewImagePath"
> {
  if (version === CONFETTI_TEMPLATE_VERSION_ID || version === ANNIVERSARY_TEMPLATE_VERSION_ID) {
    const template = version === ANNIVERSARY_TEMPLATE_VERSION_ID ? "anniversary" : "confetti";
    return {
      eventType: "birthday",
      themes: [],
      blocks: [
        { id: "celebrant-name", required: true },
        { id: "event", required: true },
        { id: "venue", required: true },
        { id: "photo", required: false },
        { id: "note", required: false },
        { id: "rsvp", required: true },
        { id: "signoff", required: false },
      ],
      demoPath: `/templates/${template}`,
      previewImagePath: `/templates/${template}/cover.svg`,
    };
  }
  const together = version === "wedding-together-v1";
  return {
    eventType: "wedding",
    themes: together ? [] : palettes[locale].map((palette) => ({ ...palette })),
    blocks: [
      { id: "names", required: true },
      { id: "event", required: true },
      { id: "venue", required: true },
      { id: "photo", required: false },
      { id: together ? "note" : "program", required: false },
      { id: "rsvp", required: true },
    ],
    demoPath: together ? "/templates/vdvoem" : "/templates/quiet-garden",
    previewImagePath: together
      ? "/templates/vdvoem/cover.svg"
      : "/templates/quiet-garden/garden.svg",
  };
}
