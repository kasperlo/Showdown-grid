import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

interface UseAuthReturn {
  isAuthReady: boolean;
  isAuthError: boolean;
}

/**
 * Custom hook for managing authentication
 * Checks for existing session or redirects to onboarding
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Skip auth check on onboarding, signup, and login pages
        if (pathname === "/onboarding" || pathname === "/signup" || pathname === "/login") {
          setIsAuthReady(true);
          return;
        }

        const supabase = createClient();

        // Check if user already has a session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          // No session found - redirect to onboarding
          console.log("[useAuth] No session found, redirecting to onboarding");
          router.push("/onboarding");
          return;
        }

        console.log(
          "[useAuth] Existing session found:",
          session.user.id,
          "Anonymous:",
          session.user.is_anonymous
        );

        setIsAuthReady(true);
      } catch (error) {
        console.error("[useAuth] Auth initialization error:", error);
        setIsAuthError(true);
        toast({
          title: "Autentiseringsfeil",
          description: "Kunne ikke initialisere autentisering.",
          variant: "destructive",
        });
      }
    };

    initAuth();
  }, [pathname, router]); // Re-run if pathname changes

  return { isAuthReady, isAuthError };
}
