import type { AnniversaryContent } from "@entities/invitation";

export const anniversaryDemoMessages = {
  ru: {
    title: "Письмо о юбилее",
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
    title: "Anniversary",
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

export type DemoSample = keyof typeof anniversaryDemoMessages.ru.samples;

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
    eyebrow: "Личное приглашение",
    letter:
      "Дорогие друзья, хочу провести этот день с вами. Приглашаю вас за большой стол, чтобы вместе вспомнить наши лучшие истории.",
    noteHeading: "Небольшая просьба",
    placeHeading: "Где",
    dateLabel: "Дата",
    caption: "Из семейного альбома",
    photoHeading: "Праздничное фото",
    rsvpHeading: "Сможете прийти?",
    rsvpIntro: "Буду рада увидеть вас",
    rsvpAction: "Подтвердить участие",
    signoff: "До встречи, Алиса!",
  },
  en: {
    eyebrow: "A personal invitation",
    letter:
      "Dear friends, join me around the table to share our favourite stories and celebrate another year.",
    noteHeading: "A small request",
    placeHeading: "Where",
    dateLabel: "Date",
    caption: "From the family album",
    photoHeading: "Party photo",
    rsvpHeading: "Can you join?",
    rsvpIntro: "I’d love to see you there",
    rsvpAction: "Confirm attendance",
    signoff: "See you soon, Alice!",
  },
};

export function anniversaryDemoContent(
  locale: AnniversaryContent["locale"],
  sample: DemoSample,
): AnniversaryContent {
  const russian = locale === "ru";
  const empty = sample === "empty";
  const optional = !empty && sample !== "minimal";
  return {
    locale,
    celebrant: empty ? "" : russian ? "Алиса" : "Alice",
    event: empty
      ? { date: "", startTime: "", timeZone: "" }
      : { date: "2030-07-21", startTime: "16:30", timeZone: "Europe/Samara" },
    venue: empty
      ? { name: "", address: "" }
      : {
          name: russian ? "Дом у сада" : "The Garden House",
          address: russian ? "Улица Фонарей, 12" : "12 Lantern Lane",
        },
    photo: {
      alt: russian ? "Письмо на тёплой бумаге" : "A letter on warm paper",
    },
    note: {
      enabled: optional,
      text: russian
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
