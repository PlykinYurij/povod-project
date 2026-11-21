import pg from "pg";
import { verifyDatabaseTarget } from "./database-safety.mjs";

/** Local maintenance only. No HTTP endpoint or environment-based auto-admin. */
export async function changeLocalAdminRole({
  connectionString,
  target,
  userId,
  action,
  marker,
}) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local role maintenance is unavailable in production.");
  }
  if (
    !["grant", "revoke"].includes(action) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId ?? "",
    )
  ) {
    throw new Error("Expected grant|revoke and an existing user UUID.");
  }
  await verifyDatabaseTarget(connectionString, target, marker);
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT role, email_verified_at FROM users WHERE id = $1::uuid FOR UPDATE",
      [userId],
    );
    const user = rows[0];
    if (!user) throw new Error("User does not exist; no account was created.");
    if (action === "grant" && !user.email_verified_at) {
      throw new Error(
        "Confirm the account email before granting admin access.",
      );
    }
    const role = action === "grant" ? "ADMIN" : "USER";
    await client.query(
      'UPDATE users SET role = $1::"UserRole" WHERE id = $2::uuid',
      [role, userId],
    );
    await client.query("COMMIT");
    return {
      userId,
      previousRole: user.role,
      role,
      changed: user.role !== role,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
