import { expect, test } from "vitest";
import { createConfettiDraft } from "./confetti-template.js";
import { validateConfettiComplete, validateConfettiDraft } from "./validate-confetti.js";

test("creates an editable draft and reports missing publication fields", () => {
  const draft = createConfettiDraft("День рождения");
  expect(draft.templateVersionId).toBe("birthday-confetti-v1");
  expect(draft.content).toMatchObject({ locale: "ru", celebrantName: "", photo: { mediaId: null } });
  expect(() => validateConfettiComplete(draft)).toThrow(
    expect.objectContaining({
      response: expect.objectContaining({ fields: expect.arrayContaining([
        { path: "content.celebrantName", code: "REQUIRED" },
        { path: "content.event.date", code: "REQUIRED" },
      ]) }),
    }),
  );
});

test("accepts complete content without optional blocks and preserves authored text", () => {
  const draft = createConfettiDraft("День рождения");
  draft.content.celebrantName = "Алина";
  draft.content.event = { date: "2028-02-29", startTime: "18:00", timeZone: "Europe/Samara" };
  draft.content.venue = { name: "Дом", address: "Самара, 1" };
  draft.content.note.body = "Введённый текст";
  draft.content.copy.rsvpAction = "Смогу прийти";
  expect(validateConfettiComplete(draft)).toEqual(draft);
});

test("rejects unknown nested fields, invalid dates, overlong names and media IDs", () => {
  const draft = createConfettiDraft("День рождения");
  const content = {
    ...draft.content,
    celebrantName: "🎉".repeat(21),
    event: { ...draft.content.event, date: "2027-02-29", extra: "x" },
    photo: { ...draft.content.photo, mediaId: "unknown" },
  };
  expect(() => validateConfettiDraft({ ...draft, content })).toThrow(
    expect.objectContaining({
      response: expect.objectContaining({ fields: expect.arrayContaining(
        ["content.celebrantName", "content.event.date", "content.event.extra", "content.photo.mediaId"]
          .map((path) => expect.objectContaining({ path })),
      ) }),
    }),
  );
});
