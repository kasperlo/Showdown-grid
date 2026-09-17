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
  const setCurrentUserId = useGameStore((s) => s.setCurrentUserId);

  // Ownership decides whether anything may be written at all, so the user id is
  // resolved once here rather than per page.
  useEffect(() => {
    if (!isAuthReady) return;
    let cancelled = false;

    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setCurrentUserId(data.user?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setCurrentUserId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, setCurrentUserId]);

  useSessionAutoSave();
  useTemplateAutoSave();

  if (!isAuthReady && !AUTH_PATHS.has(pathname)) {
    return <FullScreenLoader message="Laster…" />;
  }

  return <>{children}</>;
};
