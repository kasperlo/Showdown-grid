"use client";

import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useGameStore } from "@/utils/store";
import { useAuth } from "@/hooks/useAuth";
import { useSessionAutoSave } from "@/hooks/useSessionAutoSave";
import { useTemplateAutoSave } from "@/hooks/useTemplateAutoSave";
import { createClient } from "@/lib/supabase";

function FullScreenLoader({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center gap-4">
      <div
        className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
        role="status"
        aria-label={message}
      />
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );
}

const AUTH_PATHS = new Set(["/onboarding", "/signup", "/login"]);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthReady } = useAuth();
  const pathname = usePathname();
  const setCurrentUser = useGameStore((s) => s.setCurrentUser);

  // Ownership decides whether anything may be written at all, and the user menu
  // needs the same facts, so the user is resolved once here rather than per page.
  //
  // It also has to follow auth changes, not just read the user on mount: signing
  // in is a client-side navigation, so without the subscription the new account
  // kept a null user id until a full reload — and a null id means
  // canEditActiveQuiz() is false, which silently turned off saving.
  useEffect(() => {
    if (!isAuthReady) return;
    const supabase = createClient();
    let cancelled = false;

    const apply = (
      user: { id: string; email?: string; is_anonymous?: boolean } | null
    ) => {
      if (cancelled) return;
      setCurrentUser({
        id: user?.id ?? null,
        email: user?.email ?? null,
        // The session object from onAuthStateChange does not always carry
        // is_anonymous, and defaulting it to false labelled guests "Bruker" and
        // hid the sign-in entry from them. Every real account here signs up with
        // an email, so a user without one is a guest.
        isAnonymous: user ? (user.is_anonymous ?? !user.email) : false,
      });
    };

    supabase.auth
      .getUser()
      .then(({ data }) => apply(data.user ?? null))
      .catch(() => apply(null));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => apply(session?.user ?? null)
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [isAuthReady, setCurrentUser]);

  useSessionAutoSave();
  useTemplateAutoSave();

  if (!isAuthReady && !AUTH_PATHS.has(pathname) && !pathname.startsWith("/join/")) {
    return <FullScreenLoader message="Laster…" />;
  }

  return <>{children}</>;
};
