import type { Locale } from "@shared/config/locale";

// Presentation data only. Media access and RSVP submission belong to the caller.
export type TogetherInvitationContent = {
  readonly locale: Locale;
  readonly names: { readonly first: string; readonly second: string };
  readonly event: {
    readonly date: string;
    readonly startTime: string;
    readonly timeZone: string;
  };
  readonly venue: { readonly name: string; readonly address: string };
  readonly photo: { readonly alt: string };
  readonly note: {
    readonly enabled: boolean;
    readonly heading: string;
    readonly body: string;
  };
  readonly copy: {
    readonly heroLabel: string;
    readonly separator: string;
    readonly intro: string;
    readonly eventHeading: string;
    readonly dateLabel: string;
    readonly venueLabel: string;
    readonly photoHeading: string;
    readonly rsvpHeading: string;
    readonly rsvpIntro: string;
    readonly rsvpAction: string;
    readonly signoff: string;
  };
};

export type TogetherInvitationMedia =
  | { status: "pending" | "unavailable" }
  | {
      status: "ready";
      src: string;
      width: number;
      height: number;
      objectUrl?: boolean;
    };

export const togetherMessages = {
  ru: {
    draft: "Черновик приглашения",
    event: "Дата и место",
    date: "Дата и время",
    dateMissing: "Дата и время не указаны",
    venue: "Место",
    venueMissing: "Место не указано",
    photo: "Фото",
    pending: "Фото обрабатывается",
    unavailable: "Фото недоступно",
    note: "Пожелания",
    rsvp: "Ответ на приглашение",
  },
  en: {
    draft: "Invitation draft",
    event: "Date and venue",
    date: "Date and time",
    dateMissing: "Date and time are missing",
    venue: "Venue",
    venueMissing: "Venue is missing",
    photo: "Photo",
    pending: "The photo is being processed",
    unavailable: "The photo is unavailable",
    note: "A note for guests",
    rsvp: "Respond to the invitation",
  },
} satisfies Record<Locale, Record<string, string>>;
