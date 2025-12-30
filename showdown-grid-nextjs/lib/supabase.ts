import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Development workaround for SSL certificate issues
        // In production, the browser handles SSL verification
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        // Add custom headers to help with SSL issues
        headers: {
          'X-Client-Info': 'showdown-grid-nextjs',
        },
      },
      cookies: {
        get(name: string) {
          if (typeof document === "undefined") return undefined;
          const cookies = document.cookie.split(";");
          const cookie = cookies.find((c) => c.trim().startsWith(`${name}=`));
          return cookie?.split("=")[1];
        },
        set(name: string, value: string, options: { maxAge?: number } = {}) {
          if (typeof document === "undefined") return;
          let cookieString = `${name}=${value}; path=/; SameSite=Lax; Secure`;
          if (options?.maxAge) {
            cookieString += `; max-age=${options.maxAge}`;
          }
          document.cookie = cookieString;
        },
        remove(name: string, _options: Record<string, unknown> = {}) {
          if (typeof document === "undefined") return;
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        },
      },
    }
  );
}
