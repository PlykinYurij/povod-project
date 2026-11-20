// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GardenContent, GardenMedia } from "../model/garden-content";
import { GardenInvitation } from "./garden-invitation";
import { getGardenCopyPreset } from "@shared/i18n/garden";

afterEach(cleanup);
afterEach(() => vi.restoreAllMocks());
const content: GardenContent = {
  locale: "ru",
  copy: getGardenCopyPreset("ru"),
  themeId: "sage",
  names: { first: "Анна", second: "Михаил" },
  event: {
    localDate: "2027-06-12",
    localTime: "16:00",
    timeZone: "Europe/Moscow",
  },
  venue: {
    name: "Сад",
    address: "Самара, Садовая улица, 12",
    routeUrl: "https://example.test/map",
  },
  program: [
    { time: "16:00", text: "Встреча" },
    { time: "17:00", text: "Церемония" },
  ],
  heroMediaId: null,
};
const media: GardenMedia = {
  id: "photo-1",
  src: "/photo.webp",
  alt: "Фото пары",
  width: 1200,
  height: 900,
};

test("server output contains only invitation fields and keeps its own language", () => {
  const input = {
    ...content,
    ownerId: "private-owner",
    email: "private@example.test",
    title: "private-title",
  };
  const html = renderToStaticMarkup(<GardenInvitation content={input} />);
  expect(html).toContain('lang="ru"');
  expect(html).toContain("Анна");
  expect(html).toContain("12 июня 2027 г.");
  for (const privateValue of [
    "private-owner",
    "private@example.test",
    "private-title",
  ])
    expect(html).not.toContain(privateValue);
});
test("null optional blocks disappear and the same renderer supports the sand palette", () => {
  render(
    <GardenInvitation
      content={{ ...content, themeId: "sand", program: null }}
    />,
  );
  expect(screen.getByRole("article").getAttribute("data-palette")).toBe("sand");
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
});
test("incomplete content shows placeholders and never fabricates a current date", () => {
  render(
    <GardenInvitation
      content={{
        ...content,
        names: { first: "", second: "" },
        event: { localDate: "", localTime: "", timeZone: "" },
        venue: { name: "", address: "", routeUrl: null },
        program: [],
      }}
    />,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "Первое имя",
  );
  expect(screen.getByText("Дата ещё не указана")).toBeTruthy();
  expect(screen.getByText("Адрес ещё не указан")).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});
test("text is escaped, dangerous links are omitted and program order stays fixed", () => {
  render(
    <GardenInvitation
      content={{
        ...content,
        names: { first: '<script>alert("x")</script>', second: "Михаил" },
        venue: { ...content.venue, routeUrl: "javascript:alert(1)" },
      }}
    />,
  );
  expect(document.querySelector("script")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "<script>",
  );
  expect(
    screen.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual(["16:00Встреча", "17:00Церемония"]);
});
test("a future RSVP component has a separate slot; rendering does not invent a working form", () => {
  render(
    <GardenInvitation
      content={content}
      rsvp={<p>В демонстрации ответы не принимаются.</p>}
    />,
  );
  expect(screen.getByRole("region", { name: "Вы с нами?" })).toBeTruthy();
  expect(document.querySelector("form")).toBeNull();
});
test("selected unresolved photo remains visible as pending instead of silently disappearing", () => {
  render(
    <GardenInvitation
      content={{ ...content, heroMediaId: "not-ready" }}
      media={media}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain("пока недоступно");
  expect(screen.queryByRole("img")).toBeNull();
});
test("photo loading, success and network failure are distinct", () => {
  const view = render(
    <GardenInvitation
      content={{ ...content, heroMediaId: media.id }}
      media={media}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("Фото загружается…");
  fireEvent.load(screen.getByRole("img"));
  expect(screen.queryByRole("status")).toBeNull();
  view.rerender(
    <GardenInvitation
      content={{ ...content, heroMediaId: media.id }}
      media={{ ...media, src: "/replacement.webp" }}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("Фото загружается…");
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("alert").textContent).toContain(
    "Не удалось загрузить фото",
  );
  expect(screen.queryByRole("img")).toBeNull();
});

test("a cached image loaded before hydration does not stay in loading state", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    1200,
  );
  render(
    <GardenInvitation
      content={{ ...content, heroMediaId: media.id }}
      media={media}
    />,
  );
  expect(screen.getByRole("img")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});

test("all template copy comes from owner content, including section labels and footer", () => {
  const copy = {
    invitationLabel: "Our celebration",
    namesConnector: "+",
    introduction: "Your words, kept literally: {guest}\nA second line.",
    detailsTitle: "Join us here",
    whenLabel: "The date",
    whereLabel: "The place",
    startTimeLabel: "Doors open at",
    timeZoneLabel: "Our local time",
    routeLabel: "Find our venue",
    programEyebrow: "A few plans",
    programTitle: "The schedule",
    rsvpEyebrow: "Tell us your plans",
    rsvpTitle: "Can you make it?",
    footerText: "With love, from both of us",
  };
  const html = renderToStaticMarkup(
    <GardenInvitation content={{ ...content, copy }} rsvp={<p>RSVP slot</p>} />,
  );
  for (const text of Object.values(copy)) expect(html).toContain(text);
  expect(html).not.toContain("Свадебное приглашение");
  expect(html).not.toContain("Самые тёплые моменты");
});

test("owner copy is escaped and intentional empty text is not replaced by a preset", () => {
  const copy = {
    ...content.copy,
    introduction: "",
    footerText: "",
    detailsTitle: '<script>alert("copy")</script>',
  };
  render(<GardenInvitation content={{ ...content, copy }} />);
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByRole("heading", { name: copy.detailsTitle })).toBeTruthy();
  expect(screen.queryByText(content.copy.footerText)).toBeNull();
  expect(screen.queryByText(content.copy.introduction)).toBeNull();
});

test("invitation locale controls only system copy and formatting, not owner content", () => {
  render(
    <GardenInvitation
      content={{
        ...content,
        locale: "en",
        copy: {
          ...getGardenCopyPreset("en"),
          introduction: "Мой собственный текст",
        },
        names: { first: "", second: "" },
      }}
    />,
  );
  expect(screen.getByRole("article").lang).toBe("en");
  expect(screen.getByText("First name")).toBeTruthy();
  expect(screen.getByText("June 12, 2027")).toBeTruthy();
  expect(screen.getByText("Мой собственный текст")).toBeTruthy();
});
