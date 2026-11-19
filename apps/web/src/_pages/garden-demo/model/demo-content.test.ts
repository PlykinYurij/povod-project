import { expect, test } from "vitest";
import { selectGardenDemo, gardenDemoContent } from "./demo-content";

test("only known palette/sample parameters can change demo state", () => {
  expect(selectGardenDemo("sand", "minimal")).toMatchObject({
    themeId: "sand",
    program: null,
    heroMediaId: null,
  });
  expect(selectGardenDemo(["sand"], "unknown")).toEqual(gardenDemoContent);
  expect(selectGardenDemo("<script>", undefined).themeId).toBe("sage");
  expect(selectGardenDemo("sage", "empty").names.first).toBe("");
  expect(gardenDemoContent.names.first).toBe("Анна");
});
