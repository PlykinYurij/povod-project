// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { TogetherInvitationContent } from "../model/together-presentation";
import { TogetherInvitation } from "./together-invitation";

afterEach(cleanup);

const content: TogetherInvitationContent = {
  locale: "en",
  names: { first: "Alex", second: "Robin" },
  event: { date: "2027-09-18", startTime: "16:00", timeZone: "Europe/Samara" },
  venue: { name: "The Lighthouse", address: "8 Riverside Avenue" },
  photo: { alt: "Alex and Robin on a bridge" },
  note: { enabled: true, heading: "", body: "Bring comfortable shoes." },
  copy: {
    heroLabel: "Our wedding",
    separator: "and",
    intro: "Come dance with us.",
    eventHeading: "",
    dateLabel: "We meet",
    venueLabel: "Meet at",
    photoHeading: "",
    rsvpHeading: "",
    rsvpIntro: "Let us know if you can come.",
    rsvpAction: "Save my place",
    signoff: "See you there!",
  },
};

test("renders author copy, event locale, accessible untitled sections and the provided RSVP action", () => {
  render(
    <TogetherInvitation
      content={content}
      renderRsvp={({ label, className }) => (
        <button type="button" className={className} disabled>
          {label}
        </button>
      )}
    />,
  );

  expect(screen.getByRole("article").getAttribute("lang")).toBe("en");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "Alex",
  );
  const event = within(screen.getByRole("region", { name: "Date and venue" }));
  expect(
    event.getByText(/September 18, 2027.*4:00.*Europe\/Samara/),
  ).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "A note for guests" }),
  ).toBeTruthy();
  expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  const rsvp = within(
    screen.getByRole("region", { name: "Respond to the invitation" }),
  );
  expect(
    rsvp.getByRole<HTMLButtonElement>("button", { name: "Save my place" })
      .disabled,
  ).toBe(true);
  expect(screen.queryByRole("region", { name: "Photo" })).toBeNull();
});

test("omits disabled sections, renders an empty draft and isolates failed media", () => {
  const draft = {
    ...content,
    locale: "ru" as const,
    names: { first: "", second: "" },
    event: { date: "", startTime: "", timeZone: "" },
    venue: { name: "", address: "" },
    note: { ...content.note, enabled: false },
  };
  const { rerender } = render(
    <TogetherInvitation content={draft} media={{ status: "pending" }} />,
  );
  expect(
    screen.getByRole("heading", { name: "Черновик приглашения" }),
  ).toBeTruthy();
  expect(screen.getByText("Дата и время не указаны")).toBeTruthy();
  expect(screen.getByText("Место не указано")).toBeTruthy();
  expect(screen.queryByText(content.note.body)).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Фото обрабатывается");

  rerender(
    <TogetherInvitation
      content={draft}
      media={{
        status: "ready",
        src: "/media/image.jpg",
        width: 800,
        height: 600,
      }}
    />,
  );
  const image = screen.getByRole("img", { name: content.photo.alt });
  fireEvent.error(image);
  expect(screen.getByRole("status").textContent).toBe("Фото недоступно");
  expect(
    screen.getByRole("heading", { name: "Черновик приглашения" }),
  ).toBeTruthy();
});
