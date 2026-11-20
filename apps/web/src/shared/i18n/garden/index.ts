import { createTranslator } from "next-intl";
import type { Locale } from "@shared/config/locale";
import type { GardenCopyDto } from "@shared/api/server";
import ru from "./ru.json";
import en from "./en.json";

const dictionaries = { ru, en };

/** Invitation language is explicit and never inherited from the account provider. */
export function getGardenTranslations(locale: Locale) {
  return createTranslator({ locale, messages: dictionaries[locale].system });
}

export function getGardenCopyPreset(locale: Locale): GardenCopyDto {
  // A starting value for a new invitation, never a fallback for saved owner text.
  return { ...dictionaries[locale].copy };
}
