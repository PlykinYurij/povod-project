import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/api/tests/**/*.integration.test.mts",
      "apps/api/src/modules/templates/**/*.integration.test.mts",
      "apps/api/src/modules/projects/**/*.integration.test.mts",
      "apps/api/src/modules/administration/**/*.integration.test.mts",
      "apps/api/src/modules/requests/**/*.integration.test.mts",
      "apps/api/src/modules/media/**/*.integration.test.mts",
    ],
    fileParallelism: false,
  },
});
