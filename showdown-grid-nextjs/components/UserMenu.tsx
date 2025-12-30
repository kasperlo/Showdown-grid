"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useGameStore } from "@/utils/store";
import { useQueryClient } from "@tanstack/react-query";
import { User, LogOut, Settings, UserPlus } from "lucide-react";
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

interface UserMenuProps {
  userEmail?: string;
  isAnonymous: boolean;
}

export function UserMenu({ userEmail, isAnonymous }: UserMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const resetGame = useGameStore((state) => state.resetGame);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = isAnonymous ? "Gjest" : userEmail || "Bruker";

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const supabase = createClient();

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Reset Zustand store
      resetGame();

      // Clear TanStack Query cache
      queryClient.clear();

      // Redirect based on user type
      if (isAnonymous) {
        router.push("/onboarding");
      } else {
        router.push("/login");
      }
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
          <Button variant="ghost" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="max-w-[150px] truncate">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isAnonymous ? (
            <>
              <DropdownMenuItem onClick={() => router.push("/signup")}>
                <UserPlus className="mr-2 h-4 w-4" />
                Opprett konto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : (
            <></>
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
            <AlertDialogTitle>Er du sikker på at du vil logge ut?</AlertDialogTitle>
            <AlertDialogDescription>
              {isAnonymous
                ? "Du vil bli sendt tilbake til velkomstsiden."
                : "Du kan logge inn igjen når som helst med din e-post og passord."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Logger ut..." : "Logg ut"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
