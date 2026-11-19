import { isServer, QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

let browserClient: QueryClient | undefined;

export function getQueryClient() {
  // Client Components are also rendered on the server. Never share private SSR cache.
  if (isServer) return createQueryClient();
  browserClient ??= createQueryClient();
  return browserClient;
}
