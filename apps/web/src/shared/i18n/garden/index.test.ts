import { expect, test } from "vitest";
import { getGardenCopyPreset, getGardenTranslations } from "./index";

test("changing an invitation copy preset never changes defaults for another invitation", () => {
  const first = getGardenCopyPreset("ru");
  first.invitationLabel = "Личный текст";
  expect(getGardenCopyPreset("ru").invitationLabel).toBe(
    "Свадебное приглашение",
  );
});
test("system messages can be translated without a React provider or account locale", () => {
  expect(getGardenTranslations("ru")("photoLoading")).toBe("Фото загружается…");
  expect(getGardenTranslations("en")("photoLoading")).toBe("Loading photo…");
});
