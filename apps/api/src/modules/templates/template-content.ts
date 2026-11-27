import { getSchemaPath } from "@nestjs/swagger";
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
] as const;
export type TemplateVersionId = (typeof TEMPLATE_VERSION_IDS)[number];
export type TemplateContent = GardenContentDto | TogetherContentDto;

export const templateContentModels = [GardenContentDto, TogetherContentDto];
export const templateContentSchema = {
  oneOf: templateContentModels.map((model) => ({ $ref: getSchemaPath(model) })),
};

export function createTemplateDraft(
  garden: GardenTemplateService,
  version: string,
  title: string,
) {
  return version === TOGETHER_TEMPLATE_VERSION_ID
    ? createTogetherDraft(title)
    : garden.createDraft(version, title);
}

export function templateValidators(version: string) {
  switch (version) {
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
