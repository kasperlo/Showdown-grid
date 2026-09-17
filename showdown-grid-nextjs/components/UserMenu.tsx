"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useGameStore } from "@/utils/store";
import { useQueryClient } from "@tanstack/react-query";
import { History, Library, LogIn, LogOut, User, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Reads the signed-in user from the store rather than taking it as props, so it
 * can sit on any page. It has to be on every page a user can end up on: a guest
 * with no quizzes lands on the library, and when the menu was only in the game
 * header there was no way from there to sign out or sign in.
 */
export function UserMenu({ className }: { className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const email = useGameStore((s) => s.currentUserEmail);
  const isAnonymous = useGameStore((s) => s.isAnonymousUser);
  const resetForNewUser = useGameStore((s) => s.resetForNewUser);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = isAnonymous ? "Gjest" : email || "Bruker";

  const leaveSession = async (destination: "/onboarding" | "/login") => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Both of these matter: the store keeps the quiz across client-side
    // navigation, and the query cache keeps the previous account's lists.
    resetForNewUser();
    queryClient.clear();
    router.replace(destination);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await leaveSession(isAnonymous ? "/onboarding" : "/login");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={className} title={displayName}>
            <User className="h-4 w-4 sm:mr-2" />
            {/* Icon only on a phone: the name plus the game bar's other
                controls did not fit in 320px, and the trailing one was cut off
                the edge of the screen. */}
            <span className="hidden max-w-[10rem] truncate sm:inline">
              {displayName}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {/* Also in the menu, not only on the game bar: the bar hides these
              two below sm, and on a phone that left no way to another quiz. */}
          <DropdownMenuItem onClick={() => router.push("/quizzes")}>
            <Library className="mr-2 h-4 w-4" />
            Biblioteket
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/history")}>
            <History className="mr-2 h-4 w-4" />
            Historikk
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {isAnonymous && (
            <>
              <DropdownMenuItem onClick={() => router.push("/signup")}>
                <UserPlus className="mr-2 h-4 w-4" />
                Opprett konto
              </DropdownMenuItem>
              {/* A guest who already has an account had no way in: the only
                  options were "opprett konto" and "logg ut". */}
              <DropdownMenuItem onClick={() => void leaveSession("/login")}>
                <LogIn className="mr-2 h-4 w-4" />
                Logg inn på konto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setShowLogoutDialog(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            Logg ut
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logge ut?</AlertDialogTitle>
            <AlertDialogDescription>
              {isAnonymous
                ? "Du er gjest. Quizzene du har laget er knyttet til denne gjestebrukeren, og du kommer ikke tilbake til dem etter utlogging. Vil du beholde dem, opprett en konto først."
                : "Du kan logge inn igjen når som helst med e-post og passord."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? "Logger ut…" : "Logg ut"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
