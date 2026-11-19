import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export const webAliases = Object.fromEntries(
  Object.entries({
    "@app": "_app",
    "@pages": "_pages",
    "@widgets": "widgets",
    "@features": "features",
    "@entities": "entities",
    "@shared": "shared",
  }).map(([alias, layer]) => [
    alias,
    fileURLToPath(new URL(`./apps/web/src/${layer}`, import.meta.url)),
  ]),
);

export default defineConfig({
  resolve: { alias: webAliases },
  test: {
    // Build snapshots contain copies of tests; run only the source suites.
    include: [
      "scripts/artifact/**/*.test.ts",
      "apps/web/tests/**/*.test.{ts,tsx}",
    ],
  },
});
