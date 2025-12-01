import { QueryClient } from "@tanstack/react-query";

// Factory function to create a new QueryClient
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
        retry: 1,
        // Handle 401 errors gracefully (user not authenticated)
        retryOnMount: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// Browser-side singleton
let browserQueryClient: QueryClient | undefined = undefined;

// Get QueryClient instance
// Server: always creates a new instance (prevents data leakage)
// Browser: creates singleton on first call, reuses thereafter
export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This ensures queries are not shared between different users/sessions
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}
