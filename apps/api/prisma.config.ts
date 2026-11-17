import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generation/typecheck/build do not require database credentials.
  // Migration scripts always supply a checked URL; this fallback cannot connect.
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured",
  },
});
