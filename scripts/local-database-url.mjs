import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

export function localDatabaseUrl(target) {
  if (!["dev", "test"].includes(target))
    throw new Error("Invalid local database target");
  const config = parseEnv(
    readFileSync(new URL("../infra/local/.env.local", import.meta.url), "utf8"),
  );
  const password = config[`LOCAL_${target.toUpperCase()}_PASSWORD`];
  const port = config.LOCAL_PG_PORT;
  if (
    !/^[a-f0-9]{48}$/.test(password ?? "") ||
    !/^\d+$/.test(port ?? "") ||
    Number(port) < 1 ||
    Number(port) > 65535
  )
    throw new Error("Invalid local database configuration");
  return `postgresql://povod_${target}:${password}@127.0.0.1:${port}/povod_${target}`;
}
