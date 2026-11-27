import type { ConfettiContent } from "@entities/invitation";

export const confettiDemoMessages = {
  ru: {
    title: "Конфетти",
    notice: "Демонстрация приглашения на день рождения",
    state: "Состояние приглашения",
    show: "Показать",
    samples: {
      full: "Все блоки",
      empty: "Пустой черновик",
      minimal: "Без дополнительных блоков",
      long: "Длинный текст",
      pending: "Фото обрабатывается",
      unavailable: "Фото недоступно",
    },
  },
  en: {
    title: "Confetti",
    notice: "Birthday invitation demo",
    state: "Invitation state",
    show: "Show",
    samples: {
      full: "All sections",
      empty: "Empty draft",
      minimal: "Without optional sections",
      long: "Long copy",
      pending: "Photo processing",
      unavailable: "Photo unavailable",
    },
  },
};

export type DemoSample = keyof typeof confettiDemoMessages.ru.samples;

export function resolveSample(input?: string | string[]): DemoSample {
  return input === "empty" ||
    input === "minimal" ||
    input === "long" ||
    input === "pending" ||
    input === "unavailable"
    ? input
    : "full";
}

const copy = {
  ru: {
    invitationLabel: "День рождения",
    intro: "Приходите праздновать вместе!",
    whenHeading: "Когда",
    whereHeading: "Где",
    dateLabel: "Дата",
    timeLabel: "Начало",
    photoHeading: "Праздничное фото",
    rsvpHeading: "Сможете прийти?",
    rsvpIntro: "Буду рада увидеть вас",
    rsvpAction: "Подтвердить участие",
    signoff: "До встречи, Алиса!",
  },
  en: {
    invitationLabel: "Birthday party",
    intro: "Come celebrate with me!",
    whenHeading: "When",
    whereHeading: "Where",
    dateLabel: "Date",
    timeLabel: "Start",
    photoHeading: "Party photo",
    rsvpHeading: "Can you join?",
    rsvpIntro: "I’d love to see you there",
    rsvpAction: "Confirm attendance",
    signoff: "See you soon, Alice!",
  },
};

export function confettiDemoContent(
  locale: ConfettiContent["locale"],
  sample: DemoSample,
): ConfettiContent {
  const russian = locale === "ru";
  const empty = sample === "empty";
  const optional = !empty && sample !== "minimal";
  return {
    locale,
    celebrantName: empty ? "" : russian ? "Алиса" : "Alice",
    event: empty
      ? { date: "", startTime: "", timeZone: "" }
      : { date: "2030-07-21", startTime: "16:30", timeZone: "Europe/Samara" },
    venue: empty
      ? { name: "", address: "" }
      : {
          name: russian ? "Мастерская цвета" : "The Colour Studio",
          address: russian ? "Улица Фонарей, 12" : "12 Lantern Lane",
        },
    photo: {
      alt: russian
        ? "Разноцветные фигуры конфетти"
        : "Colourful confetti shapes",
    },
    note: {
      enabled: optional,
      heading: russian ? "Маленькая просьба" : "One small request",
      body: russian
        ? "Выберите яркую деталь для образа."
        : "Wear something colourful if you like.",
    },
    copy: {
      ...copy[locale],
      signoff: optional ? copy[locale].signoff : "",
      rsvpAction:
        sample === "long"
          ? (russian ? "ПодтверждениеУчастия" : "ConfirmYourAttendance").repeat(
              3,
            )
          : copy[locale].rsvpAction,
    },
  };
}
