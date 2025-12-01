"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { getQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create QueryClient instance using useState to ensure it's created once per component mount
  // This prevents recreation on re-renders while ensuring proper server/client separation
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
