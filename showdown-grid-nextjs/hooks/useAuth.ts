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
          const { error } = await supabase.auth.signInAnonymously();

          if (error) {
            console.error('Anonymous sign-in error:', error);
            setIsAuthError(true);
            toast({
              title: "Autentiseringsfeil",
              description: "Kunne ikke logge inn. Prøv å refresh siden.",
              variant: "destructive",
            });
            return;
          }
        }

        setIsAuthReady(true);
      } catch (error) {
        console.error('Auth initialization error:', error);
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

