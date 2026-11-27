import {
  CONFETTI_TEMPLATE_VERSION_ID,
  type ConfettiDraftDto,
} from "./confetti-content.dto";
import copy from "./confetti-preset.ru.json";
import { validateConfettiDraft } from "./validate-confetti";

export function createConfettiDraft(title: string): ConfettiDraftDto {
  return validateConfettiDraft({
    templateVersionId: CONFETTI_TEMPLATE_VERSION_ID,
    title,
    content: {
      locale: "ru",
      celebrantName: "",
      event: { date: "", startTime: "", timeZone: "" },
      venue: { name: "", address: "" },
      photo: { mediaId: null, alt: "" },
      note: { enabled: false, heading: "Пожелания", body: "" },
      copy: { ...copy },
    },
  });
}
