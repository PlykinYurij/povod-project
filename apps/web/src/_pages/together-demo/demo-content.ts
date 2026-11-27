import type { TogetherInvitationContent } from "@entities/invitation";
import type { Locale } from "@shared/config/locale";

export const togetherDemoMessages = {
  ru: {
    title: "Вдвоём · демо свадебного приглашения",
    notice: "Вымышленное приглашение. Ответы гостей отключены.",
    back: "К шаблонам",
    sample: "Состояние приглашения",
    apply: "Показать",
    states: {
      full: "Готовый пример",
      minimal: "Без пожеланий",
      empty: "Пустой черновик",
      long: "Длинный текст",
      pending: "Фото обрабатывается",
      unavailable: "Фото недоступно",
    },
  },
  en: {
    title: "Together · wedding invitation demo",
    notice:
      "This invitation uses fictional details. Guest responses are disabled.",
    back: "Back to templates",
    sample: "Invitation state",
    apply: "Show",
    states: {
      full: "Complete example",
      minimal: "Without the guest note",
      empty: "Empty draft",
      long: "Long text",
      pending: "Photo processing",
      unavailable: "Photo unavailable",
    },
  },
} satisfies Record<Locale, unknown>;

const examples = {
  ru: {
    names: { first: "Алёна", second: "Роман" },
    venue: { name: "Зал «Маяк»", address: "Вымышленный город, Набережная, 8" },
    photo: { alt: "" },
    note: {
      enabled: true,
      heading: "Пожелания",
      body: "Если хотите, добавьте к образу деталь любимого цвета.",
    },
    copy: {
      heroLabel: "Приглашение на свадьбу",
      separator: "и",
      intro:
        "Хотим провести этот день с вами. Приходите на свадьбу, а вечером оставайтесь танцевать.",
      eventHeading: "Где и когда",
      dateLabel: "Встречаемся",
      venueLabel: "Место",
      photoHeading: "Наше фото",
      rsvpHeading: "Увидимся?",
      rsvpIntro: "Сообщите, сможете ли вы прийти.",
      rsvpAction: "Ответить на приглашение",
      signoff: "До встречи, Алёна и Роман",
    },
  },
  en: {
    names: { first: "Alena", second: "Roman" },
    venue: {
      name: "Lighthouse Hall",
      address: "8 Riverside Avenue, fictional town",
    },
    photo: { alt: "" },
    note: {
      enabled: true,
      heading: "A note for guests",
      body: "If you like, wear something in your favorite color.",
    },
    copy: {
      heroLabel: "Wedding invitation",
      separator: "and",
      intro:
        "We want to spend this day with you. Join us for the wedding and stay to dance.",
      eventHeading: "When and where",
      dateLabel: "Meet us at",
      venueLabel: "Venue",
      photoHeading: "Our photo",
      rsvpHeading: "Will we see you there?",
      rsvpIntro: "Please let us know if you can make it.",
      rsvpAction: "Respond to the invitation",
      signoff: "See you soon, Alena and Roman",
    },
  },
} satisfies Record<Locale, Omit<TogetherInvitationContent, "locale" | "event">>;

export const demoStates = [
  "full",
  "minimal",
  "empty",
  "long",
  "pending",
  "unavailable",
] as const;

export function selectTogetherDemo(locale: Locale, sample: unknown) {
  const state = demoStates.find((value) => value === sample) ?? "full";
  const content: TogetherInvitationContent = {
    ...examples[locale],
    locale,
    event: {
      date: "2027-09-18",
      startTime: "16:00",
      timeZone: "Europe/Samara",
    },
  };
  if (state === "empty") {
    return {
      state,
      content: {
        ...content,
        names: { first: "", second: "" },
        venue: { name: "", address: "" },
        event: { date: "", startTime: "", timeZone: "" },
        note: { ...content.note, enabled: false },
      },
    };
  }
  if (state === "minimal") {
    return {
      state,
      content: { ...content, note: { ...content.note, enabled: false } },
    };
  }
  if (state === "long") {
    const rsvpAction =
      locale === "en"
        ? "PleaseRespondToOurWeddingInvitationAndLetUsKnowWhetherYouCanCelebrateWithUs"
        : "СверхдлиннаяПодписьКнопкиПодтвержденияУчастияНаСвадебномТоржестве";
    return {
      state,
      content: { ...content, copy: { ...content.copy, rsvpAction } },
    };
  }
  return { state, content };
}
