export const LOCALE_COOKIE = "povod-locale";
export type Locale = "ru" | "en";
export function parseLocale(value?: string): Locale {
  return value === "en" ? "en" : "ru";
}
