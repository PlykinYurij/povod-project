import { expect, test } from "vitest";
import { startupErrorMessage } from "../../apps/api/src/startup-error";

test("occupied port gives an actionable message without dependency diagnostics", () => {
  expect(startupErrorMessage({ code: "EADDRINUSE", message: "private diagnostic" })).toContain("Ctrl+C");
  expect(startupErrorMessage({ code: "EADDRINUSE", message: "private diagnostic" })).not.toContain("private diagnostic");
});
test("unknown startup failures never echo credentials or stack", () => {
  const error = new Error("postgresql://user:private-password@example.test/db");
  expect(startupErrorMessage(error)).not.toContain("private-password");
  expect(startupErrorMessage(error)).toContain("Check local configuration");
});
