import { Injectable } from "@nestjs/common";
import { ApiError } from "../../../http/api-error";
import { GardenDraftDto } from "./garden-content.dto";
import { validateGardenDraft } from "./validate-garden";
import copy from "./garden-preset.ru.json";

@Injectable()
export class GardenTemplateService {
  createDraft(templateVersionId: string, title: string): GardenDraftDto {
    if (templateVersionId !== "wedding-garden-v1")
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Шаблон не найден");
    return validateGardenDraft({
      templateVersionId,
      title,
      content: {
        locale: "ru",
        themeId: "sage",
        copy: { ...copy },
        names: { first: "", second: "" },
        event: { localDate: "", localTime: "", timeZone: "" },
        venue: { name: "", address: "", routeUrl: null },
        program: null,
        heroMediaId: null,
      },
    });
  }
}
