import {
  ANNIVERSARY_TEMPLATE_VERSION_ID,
  type AnniversaryDraftDto,
} from "./anniversary-content.dto";
import copy from "./anniversary-preset.ru.json";
import { validateAnniversaryDraft } from "./validate-anniversary";

export function createAnniversaryDraft(title: string): AnniversaryDraftDto {
  return validateAnniversaryDraft({
    templateVersionId: ANNIVERSARY_TEMPLATE_VERSION_ID,
    title,
    content: {
      locale: "ru",
      celebrant: "",
      event: { date: "", startTime: "", timeZone: "" },
      venue: { name: "", address: "" },
      photo: { mediaId: null, alt: "" },
      note: { enabled: false, text: "" },
      copy: { ...copy },
    },
  });
}
