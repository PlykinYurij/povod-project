import { defineConfig } from "vitest/config";
import { webAliases } from "../../vitest.config.mts";
export default defineConfig({
  resolve: { alias: webAliases },
  test: { include: ["apps/web/src/**/*.test.{ts,tsx}"] },
});
