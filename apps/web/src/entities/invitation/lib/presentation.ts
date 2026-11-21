import type { Locale } from "@shared/config/locale";

export function presentGardenDate(value: string, locale: Locale = "ru") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return null;
  // Display the owner's calendar date, never the browser/server time zone.
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function presentGardenTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

export function presentGardenTimeZone(value: string) {
  try {
    if (!value.trim()) return null;
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: value,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function safeGardenRoute(value: string | null) {
  if (!value || /[\x00-\x20\x7f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function safeGardenImage(value: string, objectUrl = false) {
  if (/[\x00-\x20\x7f\\]/.test(value)) return null;
  if (objectUrl && typeof window !== "undefined" && value.startsWith("blob:")) {
    try {
      const url = new URL(value);
      return url.origin === window.location.origin ? url.href : null;
    } catch {
      return null;
    }
  }
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes(".."))
    return value;
  return safeGardenRoute(value);
}
