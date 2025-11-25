import { ReactNode, useEffect, useState } from "react";
import { useGameStore } from "@/utils/store";
import { useDebounce } from "@/utils/useDebounce";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

function FullScreenLoader({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const {
    loadQuizFromDB,
    loadQuizzesList,
    saveQuizToDB,
    isLoading,
    isSaving,
    categories,
    teams,
    quizTitle,
    quizDescription,
    adjustmentLog,
  } = useGameStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // 1. Sett opp anonymous authentication ved oppstart
  useEffect(() => {
    const initAuth = async () => {
      try {
        const supabase = createClient();

        // Sjekk om bruker allerede er logget inn
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Ingen sesjon funnet, logg inn anonymt
          const { error } = await supabase.auth.signInAnonymously();

          if (error) {
            console.error('Anonymous sign-in error:', error);
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
        toast({
          title: "Autentiseringsfeil",
          description: "Kunne ikke initialisere autentisering.",
          variant: "destructive",
        });
      }
    };

    initAuth();
  }, []);

  // 2. Last inn data når autentisering er klar
  useEffect(() => {
    if (isAuthReady) {
      Promise.all([
        loadQuizFromDB(),
        loadQuizzesList()
      ]).finally(() => setIsInitialized(true));
    }
  }, [isAuthReady, loadQuizFromDB, loadQuizzesList]);

  // 2. Klargjør data for autolagring
  const debouncedState = useDebounce(
    { categories, teams, quizTitle, quizDescription, adjustmentLog },
    1500
  );

  // 3. Autosave med debounce når data endres
  useEffect(() => {
    // Lagre kun hvis initialiseringen er ferdig
    // Vi sjekker også at vi ikke er midt i en innlasting, for å unngå å lagre
    // den initielle staten tilbake til databasen umiddelbart etter at den er hentet.
    if (isInitialized && !isLoading) {
      saveQuizToDB();
    }
    // Vi vil kun re-trigge denne effekten når den *debounced* verdien endrer seg.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedState, isInitialized, saveQuizToDB]);

  // Viser laste- eller feilskjerm
  if (!isAuthReady || isLoading || !isInitialized) {
    return <FullScreenLoader message="Laster din quiz..." />;
  }

  return (
    <>
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-secondary text-secondary-foreground text-sm p-2 rounded-md z-50 animate-pulse">
          Lagrer...
        </div>
      )}
      {children}
    </>
  );
};
