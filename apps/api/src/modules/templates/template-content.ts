import { getSchemaPath } from "@nestjs/swagger";
import {
  ANNIVERSARY_TEMPLATE_VERSION_ID,
  AnniversaryContentDto,
} from "./anniversary/anniversary-content.dto";
import { createAnniversaryDraft } from "./anniversary/anniversary-template";
import {
  validateAnniversaryComplete,
  validateAnniversaryContent,
  validateAnniversaryDraft,
} from "./anniversary/validate-anniversary";
import {
  CONFETTI_TEMPLATE_VERSION_ID,
  ConfettiContentDto,
} from "./confetti/confetti-content.dto";
import { createConfettiDraft } from "./confetti/confetti-template";
import {
  validateConfettiComplete,
  validateConfettiContent,
  validateConfettiDraft,
} from "./confetti/validate-confetti";
import type { GardenTemplateService } from "./garden/garden-template.service";
import { createTogetherDraft } from "./together/together-template";
import { ApiError } from "../../http/api-error";
import { GardenContentDto } from "./garden/garden-content.dto";
import {
  validateGardenComplete,
  validateGardenContent,
  validateGardenDraft,
} from "./garden/validate-garden";
import {
  TogetherContentDto,
  TOGETHER_TEMPLATE_VERSION_ID,
} from "./together/together-content.dto";
import {
  validateTogetherComplete,
  validateTogetherContent,
  validateTogetherDraft,
} from "./together/validate-together";

export const GARDEN_VERSION_ID = "wedding-garden-v1";
export const TEMPLATE_VERSION_IDS = [
  GARDEN_VERSION_ID,
  TOGETHER_TEMPLATE_VERSION_ID,
  CONFETTI_TEMPLATE_VERSION_ID,
  ANNIVERSARY_TEMPLATE_VERSION_ID,
] as const;
export type TemplateVersionId = (typeof TEMPLATE_VERSION_IDS)[number];
export type TemplateContent =
  GardenContentDto | TogetherContentDto | ConfettiContentDto | AnniversaryContentDto;

export const templateContentModels = [
  GardenContentDto,
  TogetherContentDto,
  ConfettiContentDto,
  AnniversaryContentDto,
];
export const templateContentSchema = {
  oneOf: templateContentModels.map((model) => ({ $ref: getSchemaPath(model) })),
};

export function createTemplateDraft(
  garden: GardenTemplateService,
  version: string,
  title: string,
) {
  if (version === ANNIVERSARY_TEMPLATE_VERSION_ID)
    return createAnniversaryDraft(title);
  if (version === CONFETTI_TEMPLATE_VERSION_ID)
    return createConfettiDraft(title);
  return version === TOGETHER_TEMPLATE_VERSION_ID
    ? createTogetherDraft(title)
    : garden.createDraft(version, title);
}

export function templateValidators(version: string) {
  switch (version) {
    case ANNIVERSARY_TEMPLATE_VERSION_ID:
      return {
        draft: validateAnniversaryDraft,
        complete: validateAnniversaryComplete,
        content: validateAnniversaryContent,
      };
    case GARDEN_VERSION_ID:
      return {
        draft: validateGardenDraft,
        complete: validateGardenComplete,
        content: validateGardenContent,
      };
    case TOGETHER_TEMPLATE_VERSION_ID:
      return {
        draft: validateTogetherDraft,
        complete: validateTogetherComplete,
        content: validateTogetherContent,
      };
    case CONFETTI_TEMPLATE_VERSION_ID:
      return {
        draft: validateConfettiDraft,
        complete: validateConfettiComplete,
        content: validateConfettiContent,
      };
    default:
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Шаблон не найден");
  }
}

export function templatePhoto(content: TemplateContent) {
  return "heroMediaId" in content
    ? { id: content.heroMediaId, path: "content.heroMediaId" }
    : { id: content.photo.mediaId, path: "content.photo.mediaId" };
}

export function withPublicPhoto(
  content: TemplateContent,
  token: string | null,
): TemplateContent {
  return "heroMediaId" in content
    ? { ...content, heroMediaId: token }
    : { ...content, photo: { ...content.photo, mediaId: token } };
}
