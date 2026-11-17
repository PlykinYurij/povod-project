import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const {
  createApplication,
  createOpenApiDocument,
} = require("../apps/api/dist/create-application.js");
const app = await createApplication();
try {
  writeFileSync(
    fileURLToPath(new URL("../apps/api/openapi.json", import.meta.url)),
    JSON.stringify(createOpenApiDocument(app), null, 2) + "\n",
  );
} finally {
  await app.close();
}
