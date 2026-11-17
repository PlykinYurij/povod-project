import pg from "pg";

/** Deliberately local-only. Production release migrations need a separate runbook. */
export function validateDatabaseTarget(connectionString, target, marker) {
  if (!["dev", "test"].includes(target))
    throw new Error("Choose dev or test explicitly.");
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Invalid local database URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== `/povod_${target}` ||
    url.username !== `povod_${target}` ||
    !url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Refusing database target: expected loopback and matching database/role, without URL overrides.",
    );
  }
  if (target === "test" && marker !== "povod_test")
    throw new Error("Explicit test marker is required.");
  return url;
}

export async function verifyDatabaseTarget(connectionString, target, marker) {
  validateDatabaseTarget(connectionString, target, marker);
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const {
      rows: [row],
    } =
      await client.query(`SELECT current_database() AS db, current_user AS role,
      rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls AS privileged
      FROM pg_roles WHERE rolname = current_user`);
    if (
      row?.db !== `povod_${target}` ||
      row?.role !== `povod_${target}` ||
      row.privileged !== false
    ) {
      throw new Error(
        "Database identity or privileges do not match the local target.",
      );
    }
  } finally {
    await client.end();
  }
}
