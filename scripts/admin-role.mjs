import { changeLocalAdminRole } from "./admin-role-change.mjs";
import { localDatabaseUrl } from "./local-database-url.mjs";

const [action, target, userId] = process.argv.slice(2);
try {
  if (process.argv.length !== 5 || !["dev", "test"].includes(target)) {
    throw new Error(
      "Usage: node scripts/admin-role.mjs grant|revoke dev|test USER_UUID",
    );
  }
  const connectionString =
    target === "test" && process.env.POVOD_TEST_DATABASE_URL
      ? process.env.POVOD_TEST_DATABASE_URL
      : localDatabaseUrl(target);
  const result = await changeLocalAdminRole({
    connectionString,
    target,
    userId,
    action,
    marker: target === "test" ? "povod_test" : undefined,
  });
  console.log(JSON.stringify(result));
} catch {
  // Do not echo pg errors, URLs, or credentials from local configuration.
  console.error(
    "Role update failed. Check the local target, UUID and verified email. Usage: node scripts/admin-role.mjs grant|revoke dev|test USER_UUID",
  );
  process.exitCode = 1;
}
