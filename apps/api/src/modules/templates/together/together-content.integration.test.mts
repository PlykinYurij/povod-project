import "reflect-metadata";
import { createRequire } from "node:module";
import { expect, test } from "vitest";

const require = createRequire(import.meta.url);
const {
  createTogetherDraft,
}: typeof import("./together-template.js") = require("../../../../dist/modules/templates/together/together-template.js");
const {
  validateTogetherDraft,
  validateTogetherContent,
  validateTogetherComplete,
}: typeof import("./validate-together.js") = require("../../../../dist/modules/templates/together/validate-together.js");

function completeDraft() {
  const draft = createTogetherDraft("Наш день");
  draft.content.locale = "en";
  draft.content.names = { first: "Alex", second: "Robin" };
  draft.content.event = {
    date: "2024-02-29",
    startTime: "16:30",
    timeZone: "Europe/Samara",
  };
  draft.content.venue = { name: "The Hall", address: "14 River Street" };
  draft.content.copy.rsvpAction = "RSVP";
  return draft;
}

test("creates independent editable drafts without personal or event defaults", () => {
  const draft = createTogetherDraft("");
  expect(draft.templateVersionId).toBe("wedding-together-v1");
  expect(draft.content.locale).toBe("ru");
  expect(draft.content.event).toMatchObject({
    date: "",
    startTime: "",
    timeZone: "",
  });
  expect(draft.content.photo).toMatchObject({ mediaId: null, alt: "" });
  expect(draft.content.note.enabled).toBe(false);
  expect(draft.content.copy.rsvpAction).not.toBe("");
  draft.content.copy.rsvpAction = "";
  expect(validateTogetherDraft(draft).content.copy.rsvpAction).toBe("");
  expect(createTogetherDraft("").content.copy.rsvpAction).not.toBe("");
});

test("checks completeness by field and accepts past calendar dates and blank optional content", () => {
  const incomplete = createTogetherDraft("");
  incomplete.content.copy.rsvpAction = " ";
  expect(() => validateTogetherComplete(incomplete)).toThrow(
    expect.objectContaining({
      response: expect.objectContaining({
        code: "VALIDATION_FAILED",
        fields: expect.arrayContaining([
          { path: "title", code: "REQUIRED" },
          { path: "content.event.date", code: "REQUIRED" },
          { path: "content.copy.rsvpAction", code: "REQUIRED" },
        ]),
      }),
    }),
  );
  const draft = completeDraft();
  draft.content.copy.eventHeading = "";
  draft.content.note.enabled = true;
  expect(validateTogetherComplete(draft)).toEqual(draft);
});

test("rejects invalid calendar values, wrong types, unsupported locale, and unknown nested fields", () => {
  const { content } = completeDraft();
  const invalid = {
    ...content,
    locale: "fr",
    event: { date: "2023-02-29", startTime: "24:00", timeZone: "+03:00" },
    note: { ...content.note, enabled: "false", reorder: true },
    photo: { mediaId: "invalid", alt: "" },
  };
  expect(() => validateTogetherContent(invalid)).toThrow(
    expect.objectContaining({
      response: expect.objectContaining({
        fields: expect.arrayContaining([
          { path: "locale", code: "INVALID_VALUE" },
          { path: "event.date", code: "INVALID_VALUE" },
          { path: "event.startTime", code: "INVALID_VALUE" },
          { path: "event.timeZone", code: "INVALID_VALUE" },
          { path: "note.enabled", code: "INVALID_VALUE" },
          { path: "note.reorder", code: "UNKNOWN_FIELD" },
          { path: "photo.mediaId", code: "INVALID_VALUE" },
        ]),
      }),
    }),
  );
});

test("counts editable text by Unicode code points and rejects a fallback to Garden", () => {
  const draft = completeDraft();
  draft.content.copy.rsvpAction = "💍".repeat(80);
  expect(validateTogetherComplete(draft).content.copy.rsvpAction).toBe(
    draft.content.copy.rsvpAction,
  );
  draft.content.copy.rsvpAction += "!";
  expect(() => validateTogetherDraft(draft)).toThrow("Проверьте поля");
  expect(() =>
    validateTogetherDraft({
      ...completeDraft(),
      templateVersionId: "wedding-garden-v1",
    }),
  ).toThrow("Проверьте поля");
});
