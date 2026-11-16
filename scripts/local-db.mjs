import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folder = join(root, "infra/local");
const envPath = join(folder, ".env.local");
const action = process.argv[2];
const allowed = ["init", "up", "stop", "check", "smoke"];
// An existing terminal may predate the per-user Docker installation.
const dockerBin =
  process.platform === "win32" && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Programs/DockerDesktop/resources/bin")
    : undefined;
const childEnv = {
  ...process.env,
  ...(dockerBin && existsSync(dockerBin)
    ? { PATH: `${dockerBin};${process.env.PATH ?? ""}` }
    : {}),
};

function run(args, { input, failureAllowed = false } = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    env: childEnv,
    input,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    if (failureAllowed) return result;
    // Never print raw Docker output: interpolated config may contain secrets.
    throw new Error(
      "Docker operation failed. Check Docker Desktop, port, credentials and volume initialization; no data was reset.",
    );
  }
  return result;
}
const composeArgs = [
  "compose",
  "--env-file",
  envPath,
  "-f",
  join(folder, "compose.yaml"),
];
const compose = (args, options) => run([...composeArgs, ...args], options);

function sql(role, database, query, failureAllowed = false) {
  assert.ok(["dev", "test"].includes(role));
  assert.ok(["povod_dev", "povod_test"].includes(database));
  const passwordVar = role === "dev" ? "DEV_PASSWORD" : "TEST_PASSWORD";
  // Credentials stay in the existing container environment, not command arguments.
  return compose(
    [
      "exec",
      "-T",
      "postgres",
      "sh",
      "-c",
      `export PGPASSWORD="$${passwordVar}"; exec psql -X -w -h 127.0.0.1 -U povod_${role} -d ${database} -v ON_ERROR_STOP=1 -At`,
    ],
    { input: query, failureAllowed },
  );
}

function check() {
  for (const role of ["dev", "test"]) {
    const identity = sql(
      role,
      `povod_${role}`,
      "SELECT current_database() || '|' || current_user || '|' || current_setting('server_version_num');",
    ).stdout.trim();
    assert.equal(identity, `povod_${role}|povod_${role}|170012`);
    const privileges = sql(
      role,
      `povod_${role}`,
      "SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls FROM pg_roles WHERE rolname=current_user;",
    ).stdout.trim();
    assert.equal(privileges, "f");
    const other = role === "dev" ? "povod_test" : "povod_dev";
    const denied = sql(role, other, "SELECT 1;", true);
    assert.equal(denied.status, 2);
    assert.match(denied.stderr, /permission denied for database/);
  }
  const id = compose(["ps", "-q", "postgres"]).stdout.trim();
  assert.match(id, /^[a-f0-9]+$/);
  const ports = JSON.parse(
    run(["inspect", "--format", "{{json .NetworkSettings.Ports}}", id]).stdout,
  );
  assert.ok(ports["5432/tcp"]?.length);
  for (const port of ports["5432/tcp"]) assert.equal(port.HostIp, "127.0.0.1");
  console.log(
    "PASS: PostgreSQL 17.12, identities, restricted roles, cross-database denial, loopback binding.",
  );
}

try {
  if (!allowed.includes(action))
    throw new Error(`Usage: node scripts/local-db.mjs ${allowed.join("|")}`);
  if (process.argv.length !== 3) throw new Error("Unexpected arguments.");
  if (action === "init") {
    const secrets = ["ADMIN", "DEV", "TEST"].map(
      (name) => `LOCAL_${name}_PASSWORD=${randomBytes(24).toString("hex")}`,
    );
    writeFileSync(envPath, `LOCAL_PG_PORT=15432\n${secrets.join("\n")}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      "Created ignored infra/local/.env.local; existing files are never overwritten.",
    );
  } else {
    if (!existsSync(envPath))
      throw new Error("Run node scripts/local-db.mjs init first.");
    const config = readFileSync(envPath, "utf8");
    for (const name of ["ADMIN", "DEV", "TEST"]) {
      assert.match(
        config,
        new RegExp(`^LOCAL_${name}_PASSWORD=[a-f0-9]{48}$`, "m"),
      );
    }
    if (action === "up") {
      compose(["up", "-d", "--wait", "--wait-timeout", "90"]);
      check();
    } else if (action === "stop") {
      compose(["stop", "postgres"]);
      console.log("Stopped local PostgreSQL; volume retained.");
    } else if (action === "check") check();
    else {
      check();
      const marker = randomBytes(16).toString("hex");
      const beforeId = compose(["ps", "-q", "postgres"]).stdout.trim();
      for (const role of ["dev", "test"]) {
        sql(
          role,
          `povod_${role}`,
          `CREATE SCHEMA IF NOT EXISTS e105_probe;
          CREATE TABLE IF NOT EXISTS e105_probe.markers (marker text PRIMARY KEY);
          INSERT INTO e105_probe.markers VALUES ('${marker}');`,
        );
      }
      compose(["up", "-d", "--wait", "--wait-timeout", "90"]);
      assert.equal(compose(["ps", "-q", "postgres"]).stdout.trim(), beforeId);
      compose(["stop", "postgres"]);
      const stopped = sql("dev", "povod_dev", "SELECT 1;", true);
      assert.notEqual(stopped.status, 0);
      compose(["up", "-d", "--wait", "--wait-timeout", "90"]);
      check();
      for (const role of ["dev", "test"]) {
        assert.equal(
          sql(
            role,
            `povod_${role}`,
            `SELECT count(*) FROM e105_probe.markers WHERE marker='${marker}';`,
          ).stdout.trim(),
          "1",
        );
      }
      console.log(
        "PASS: repeated up preserves container; stopped access fails; restart preserves both synthetic markers.",
      );
    }
  }
} catch (error) {
  console.error(
    error.code === "EEXIST"
      ? "Local env already exists; left unchanged."
      : error instanceof assert.AssertionError
        ? "Local database verification failed; no cleanup performed."
        : error.message,
  );
  process.exitCode = 1;
}
