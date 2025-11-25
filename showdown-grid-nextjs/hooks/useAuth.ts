import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface UseAuthReturn {
  isAuthReady: boolean;
  isAuthError: boolean;
}

/**
 * Custom hook for managing anonymous authentication
 * Handles session checking and anonymous sign-in on mount
 */
export function useAuth(): UseAuthReturn {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const supabase = createClient();

        // Check if user already has a session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // No session found, sign in anonymously
          console.log('[useAuth] No session found, signing in anonymously...');
          const { data, error } = await supabase.auth.signInAnonymously();

          if (error) {
            console.error('[useAuth] Anonymous sign-in error:', error);
            setIsAuthError(true);
            toast({
              title: "Autentiseringsfeil",
              description: "Kunne ikke logge inn. Prøv å refresh siden.",
              variant: "destructive",
            });
            return;
          }

          console.log('[useAuth] Anonymous sign-in successful:', data.user?.id);

          // Wait for cookies to be set and propagate
          await new Promise(resolve => setTimeout(resolve, 300));

          // Verify session can be retrieved
          const { data: { session: verifiedSession } } = await supabase.auth.getSession();
          if (!verifiedSession) {
            console.error('[useAuth] Session verification failed - session not retrievable');
            setIsAuthError(true);
            toast({
              title: "Autentiseringsfeil",
              description: "Session kunne ikke verifiseres. Prøv å refresh siden.",
              variant: "destructive",
            });
            return;
          }

          console.log('[useAuth] Session verified successfully');
        } else {
          console.log('[useAuth] Existing session found:', session.user.id);
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
  }, []); // Empty deps - only run once on mount

  return { isAuthReady, isAuthError };
}

