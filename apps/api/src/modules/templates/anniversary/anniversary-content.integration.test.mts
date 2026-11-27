import { expect, test } from "vitest";
import { createAnniversaryDraft } from "./anniversary-template.js";
import { validateAnniversaryComplete, validateAnniversaryDraft } from "./validate-anniversary.js";

test("creates an editable draft and reports missing publication fields", () => {
  const draft = createAnniversaryDraft("День рождения");
  expect(draft.templateVersionId).toBe("birthday-anniversary-v1");
  expect(draft.content).toMatchObject({ locale: "ru", celebrant: "", photo: { mediaId: null } });
  expect(() => validateAnniversaryComplete(draft)).toThrow(
    expect.objectContaining({
      response: expect.objectContaining({ fields: expect.arrayContaining([
        { path: "content.celebrant", code: "REQUIRED" },
        { path: "content.event.date", code: "REQUIRED" },
      ]) }),
    }),
  );
});

test("accepts complete content without optional blocks and preserves authored text", () => {
  const draft = createAnniversaryDraft("День рождения");
  draft.content.celebrant = "Алина";
  draft.content.event = { date: "2028-02-29", startTime: "18:00", timeZone: "Europe/Samara" };
  draft.content.venue = { name: "Дом", address: "Самара, 1" };
  draft.content.note.text = "Введённый текст";
  draft.content.copy.rsvpAction = "Смогу прийти";
  expect(validateAnniversaryComplete(draft)).toEqual(draft);
});

test("rejects unknown nested fields, invalid dates, overlong names and media IDs", () => {
  const draft = createAnniversaryDraft("День рождения");
  const content = {
    ...draft.content,
    celebrant: "🎉".repeat(21),
    event: { ...draft.content.event, date: "2027-02-29", extra: "x" },
    photo: { ...draft.content.photo, mediaId: "unknown" },
  };
  expect(() => validateAnniversaryDraft({ ...draft, content })).toThrow(
    expect.objectContaining({
      response: expect.objectContaining({ fields: expect.arrayContaining(
        ["content.celebrant", "content.event.date", "content.event.extra", "content.photo.mediaId"]
          .map((path) => expect.objectContaining({ path })),
      ) }),
    }),
  );
});
