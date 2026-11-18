/** Startup diagnostics must remain visible even when request logging is disabled. */
export function startupErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? error.code : undefined;
  if (code === "EADDRINUSE")
    return "API failed to start: port is already in use. Stop the existing API terminal with Ctrl+C, then run npm run dev:api:database.";
  if (code === "EACCES" || code === "EPERM")
    return "API failed to start: access to the configured port was denied. Check the port and local permissions.";
  if (error instanceof Error && error.message === "PORT must be an integer between 1 and 65535.")
    return error.message;
  // Never echo arbitrary error.message/stack: dependency errors may contain credentials.
  return "API startup failed. Check local configuration, dependencies and the configured port. No credentials were logged.";
}
