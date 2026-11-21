import { createRequire } from "node:module";
import { localDatabaseUrl } from "./local-database-url.mjs";

try {
  process.env.DATABASE_URL = localDatabaseUrl("dev");
  const require = createRequire(import.meta.url);
  const { startPhotoWorker } = require("../apps/api/dist/photo-worker.js");
  await startPhotoWorker();
} catch {
  console.error(
    "Photo worker could not start. Check the API build, local database and MEDIA_S3 settings.",
  );
  process.exitCode = 1;
}
