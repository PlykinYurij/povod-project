import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/api/tests/**/*.integration.test.mts",
      "apps/api/src/modules/templates/**/*.integration.test.mts",
    ],
    fileParallelism: false,
  },
});
