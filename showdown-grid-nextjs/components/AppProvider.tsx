import { ReactNode, useEffect, useState, useMemo } from "react";
import { useGameStore } from "@/utils/store";
import { useUser } from "@stackframe/react";
import { useDebounce } from "@/utils/useDebounce";

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
    saveQuizToDB,
    isLoading,
    isSaving,
    error,
    categories,
    teams,
    gameTitle,
    gameDescription,
    adjustmentLog,
  } = useGameStore();

  const user = useUser();
  const isSignedIn = !!user;
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Last inn data ved oppstart for innloggede brukere
  useEffect(() => {
    if (isSignedIn) {
      loadQuizFromDB().finally(() => setIsInitialized(true));
    } else {
      setIsInitialized(true); // For uinnloggede, bare fortsett
    }
  }, [isSignedIn, loadQuizFromDB]);

  // 2. Klargjør data for autolagring
  const debouncedState = useDebounce(
    { categories, teams, gameTitle, gameDescription, adjustmentLog },
    1500
  );

  // 3. Autosave med debounce når data endres
  useEffect(() => {
    // Lagre kun hvis initialiseringen er ferdig og brukeren er logget inn.
    // Vi sjekker også at vi ikke er midt i en innlasting, for å unngå å lagre
    // den initielle staten tilbake til databasen umiddelbart etter at den er hentet.
    if (isInitialized && isSignedIn && !isLoading) {
      saveQuizToDB();
    }
    // Vi vil kun re-trigge denne effekten når den *debounced* verdien endrer seg.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedState, isInitialized, isSignedIn, saveQuizToDB]);

  // Viser laste- eller feilskjerm
  if ((isLoading || !isInitialized) && isSignedIn) {
    return <FullScreenLoader message="Laster din quiz..." />;
  }

  if (error) {
    return <FullScreenLoader message={`Feil: ${error}`} />;
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
