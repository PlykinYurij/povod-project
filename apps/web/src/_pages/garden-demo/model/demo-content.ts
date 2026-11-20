import type { GardenContent, GardenMedia } from "@entities/invitation";
import { getGardenCopyPreset } from "@shared/i18n/garden";

export const gardenDemoContent: GardenContent = {
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
    name: "Усадьба «Тихий сад»",
    address: "Самара, Садовая улица, 12",
    routeUrl: null,
  },
  program: [
    { time: "16:00", text: "Встречаемся в саду" },
    { time: "16:30", text: "Церемония под открытым небом" },
    { time: "18:00", text: "Ужин и тёплые разговоры" },
  ],
  heroMediaId: "demo-garden-illustration",
};

export const gardenDemoMedia: GardenMedia = {
  id: "demo-garden-illustration",
  src: "/templates/quiet-garden/garden.svg",
  alt: "Иллюстрация для демо: дорожка к свадебной арке в саду",
  width: 960,
  height: 720,
};

export function selectGardenDemo(
  palette: unknown,
  sample: unknown,
): GardenContent {
  const content = {
    ...gardenDemoContent,
    themeId: palette === "sand" ? ("sand" as const) : ("sage" as const),
  };
  if (sample === "empty")
    return {
      ...content,
      names: { first: "", second: "" },
      event: { localDate: "", localTime: "", timeZone: "" },
      venue: { name: "", address: "", routeUrl: null },
      program: null,
      heroMediaId: null,
    };
  if (sample === "minimal")
    return { ...content, program: null, heroMediaId: null };
  if (sample === "media-pending")
    return { ...content, heroMediaId: "not-ready-demo-photo" };
  return content;
}
