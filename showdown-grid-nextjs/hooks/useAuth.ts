import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

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
        // Skip auth check on onboarding and signup pages
        if (pathname === '/onboarding' || pathname === '/signup') {
          setIsAuthReady(true);
          return;
        }

        const supabase = createClient();

        // Check if user already has a session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // No session found
          // Check if user has chosen auth method before
          const hasChosenAuthMethod = typeof window !== 'undefined' && 
            localStorage.getItem('auth-method-chosen') === 'true';

          if (!hasChosenAuthMethod) {
            // User hasn't chosen auth method, redirect to onboarding
            console.log('[useAuth] No session and no auth method chosen, redirecting to onboarding');
            router.push('/onboarding');
            return;
          } else {
            // User has chosen before but session is lost
            // This shouldn't happen in normal flow, but handle gracefully
            console.error('[useAuth] Auth method was chosen but session is lost');
            setIsAuthError(true);
            toast({
              title: "Session utløpt",
              description: "Vennligst logg inn på nytt.",
              variant: "destructive",
            });
            localStorage.removeItem('auth-method-chosen');
            router.push('/onboarding');
            return;
          }
        }

        console.log('[useAuth] Existing session found:', session.user.id, 
          'Anonymous:', session.user.is_anonymous);
        
        // Ensure auth-method-chosen is set for existing sessions
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth-method-chosen', 'true');
        }

        setIsAuthReady(true);
      } catch (error) {
        console.error('[useAuth] Auth initialization error:', error);
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

