import type { QueryClient } from "@tanstack/react-query";

export async function clearPrivateQueries(client: QueryClient): Promise<void> {
  // Cancel first so a late response from the previous owner cannot repopulate cache.
  await client.cancelQueries();
  client.removeQueries();
}
