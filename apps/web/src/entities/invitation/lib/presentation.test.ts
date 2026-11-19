import { expect, test } from "vitest";
import {
  presentGardenDate,
  presentGardenTime,
  presentGardenTimeZone,
  safeGardenRoute,
  safeGardenImage,
} from "./presentation";

test("calendar dates are displayed without converting the owner's local date", () => {
  expect(presentGardenDate("2027-06-12")).toBe("12 июня 2027 г.");
  expect(presentGardenDate("2000-02-29")).toBe("29 февраля 2000 г.");
  expect(presentGardenDate("2001-01-01")).toBe("1 января 2001 г.");
});
test.each([
  "",
  "2027-02-29",
  "1900-02-29",
  "2027-04-31",
  "2027-13-01",
  "2027-01-00",
  "2027-6-12",
  "2027-06-12T00:00:00Z",
])("invalid calendar date uses an explicit placeholder: %s", (value) => {
  expect(presentGardenDate(value)).toBeNull();
});
test("times and IANA time zones stay explicit; invalid values do not become current time", () => {
  expect(presentGardenTime("00:00")).toBe("00:00");
  expect(presentGardenTime("23:59")).toBe("23:59");
  expect(presentGardenTime("24:00")).toBeNull();
  expect(presentGardenTime("16:0")).toBeNull();
  expect(presentGardenTimeZone("Europe/Moscow")).toBe("Europe/Moscow");
  expect(presentGardenTimeZone("not-a-zone")).toBeNull();
  expect(presentGardenTimeZone("")).toBeNull();
});
test.each([
  null,
  "javascript:alert(1)",
  "http://example.test/map",
  "//example.test",
  "https://owner:password@example.test",
  "https://example.test/\nmap",
  "https:\\example.test",
])("route rejects unsafe values: %s", (value) => {
  expect(safeGardenRoute(value)).toBeNull();
});
test("route keeps a safe HTTPS destination and image sources cannot use data or external protocol-relative URLs", () => {
  expect(safeGardenRoute("https://example.test/map?id=12")).toBe(
    "https://example.test/map?id=12",
  );
  expect(safeGardenImage("/templates/quiet-garden/garden.svg")).toBe(
    "/templates/quiet-garden/garden.svg",
  );
  expect(safeGardenImage("https://images.example.test/photo.webp")).toBe(
    "https://images.example.test/photo.webp",
  );
  for (const value of [
    "data:image/svg+xml,example",
    "//example.test/photo.webp",
    "/../private",
    "/\\example.test",
    "file:///private",
  ])
    expect(safeGardenImage(value)).toBeNull();
});
