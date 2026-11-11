import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Build snapshots contain copies of tests; only the source suite belongs here.
    include: ["scripts/artifact/**/*.test.ts"],
  },
});
