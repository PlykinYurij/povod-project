import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, parseLocale } from "@shared/config/locale";

const dictionaries = {
  ru: () => import("./ru.json").then((module) => module.default),
  en: () => import("./en.json").then((module) => module.default),
};

export default getRequestConfig(async () => {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, messages: await dictionaries[locale](), timeZone: "UTC" };
});
