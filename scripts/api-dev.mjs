import { spawn } from "node:child_process";
import { localDatabaseUrl } from "./local-database-url.mjs";
import { fileURLToPath } from "node:url";
const child = spawn(
  process.execPath,
  [
    "--watch",
    "--watch-path=src",
    "--require",
    "ts-node/register",
    "src/main.ts",
  ],
  {
    cwd: fileURLToPath(new URL("../apps/api", import.meta.url)),
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: localDatabaseUrl("dev"),
      LOCAL_MAIL_DIR: process.env.LOCAL_MAIL_DIR ?? fileURLToPath(new URL("../.local-mail/", import.meta.url)),
    },
  },
);
child.on("error", () => {
  console.error("API failed to start");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
