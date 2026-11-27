import {
  TOGETHER_TEMPLATE_VERSION_ID,
  type TogetherDraftDto,
} from "./together-content.dto";
import copy from "./together-preset.ru.json";
import { validateTogetherDraft } from "./validate-together";

export function createTogetherDraft(title: string): TogetherDraftDto {
  return validateTogetherDraft({
    templateVersionId: TOGETHER_TEMPLATE_VERSION_ID,
    title,
    content: {
      locale: "ru",
      names: { first: "", second: "" },
      event: { date: "", startTime: "", timeZone: "" },
      venue: { name: "", address: "" },
      photo: { mediaId: null, alt: "" },
      note: { enabled: false, heading: "Пожелания", body: "" },
      copy: { ...copy },
    },
  });
}
