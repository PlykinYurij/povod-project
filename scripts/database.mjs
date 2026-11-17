import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { createRequire } from "node:module";
import { verifyDatabaseTarget } from "./database-safety.mjs";
import { localDatabaseUrl } from "./local-database-url.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const api = join(root, "apps/api");
const require = createRequire(import.meta.url);
const [action, target] = process.argv.slice(2);

function execute(args, env) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 180000,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    if (env.POVOD_DB_DIAGNOSTICS === "1") {
      const secret = new URL(env.DATABASE_URL).password;
      console.error(
        `${result.stdout ?? ""}\n${result.stderr ?? ""}`
          .replaceAll(env.DATABASE_URL, "[database URL]")
          .replaceAll(secret, "[password]"),
      );
    }
    throw new Error(
      "Database operation failed; raw output withheld to protect credentials.",
    );
  }
  // Success output is useful for test evidence; remove the complete URL and password.
  const password = new URL(env.DATABASE_URL).password;
  console.log(
    result.stdout
      .replaceAll(env.DATABASE_URL, "[database URL]")
      .replaceAll(password, "[password]"),
  );
  console.log(`${action}: subprocess completed.`);
}

try {
  if (
    !["migrate", "seed", "test"].includes(action) ||
    !["dev", "test"].includes(target) ||
    process.argv.length !== 4
  ) {
    throw new Error(
      "Usage: node scripts/database.mjs migrate|seed|test dev|test",
    );
  }
  if (action === "test" && target !== "test")
    throw new Error("Tests may only target test.");
  let connectionString;
  if (process.env.POVOD_TEST_DATABASE_URL && target === "test") {
    connectionString = process.env.POVOD_TEST_DATABASE_URL;
    if (process.env.POVOD_TEST_DATABASE !== "povod_test")
      throw new Error("Explicit test marker is required.");
  } else {
    connectionString = localDatabaseUrl(target);
  }
  // No migrations/seed/test writes occur before identity and privilege checks.
  await verifyDatabaseTarget(
    connectionString,
    target,
    target === "test" ? "povod_test" : undefined,
  );
  const env = {
    ...process.env,
    DATABASE_URL: connectionString,
    POVOD_TEST_DATABASE_URL: target === "test" ? connectionString : "",
    POVOD_TEST_DATABASE: target === "test" ? "povod_test" : "",
  };
  if (action === "migrate") {
    execute(
      [
        join(root, "node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--config",
        join(api, "prisma.config.ts"),
      ],
      env,
    );
  } else if (action === "test") {
    execute(
      [
        join(root, "node_modules/vitest/vitest.mjs"),
        "run",
        "--config",
        join(api, "vitest.integration.config.mts"),
      ],
      env,
    );
  } else {
    const { createDatabaseClient } = require(
      join(api, "dist/database/create-database-client.js"),
    );
    const client = createDatabaseClient(connectionString);
    try {
      await client.databaseProbe.upsert({
        where: { id: "e106-synthetic-seed" },
        create: {
          id: "e106-synthetic-seed",
          label: "Synthetic technical fixture",
        },
        update: { label: "Synthetic technical fixture" },
      });
    } finally {
      await client.$disconnect();
    }
    console.log("Synthetic technical seed applied (idempotent).");
  }
} catch {
  console.error(
    "Local database command refused or failed. Check explicit target, test marker, Docker readiness and build/migrations. No reset was performed.",
  );
  process.exitCode = 1;
}
