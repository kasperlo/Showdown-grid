"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useGameStore } from "@/utils/store";
import { useActivateQuiz } from "@/hooks/mutations/useQuizMutations";
import { rememberPublicPlay } from "@/utils/live-snapshot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";

type JoinState = { status: "working" } | { status: "error"; message: string };

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const activateQuiz = useActivateQuiz();
  const [state, setState] = useState<JoinState>({ status: "working" });
  const ran = useRef(false);

  useEffect(() => {
    // React's development double-mount would otherwise redeem the link twice
    // in a row; the second call is harmless (the RPC is idempotent) but would
    // also double the network round trip on the one path a first-time guest
    // is watching most closely.
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isRealAccount = user && !user.is_anonymous && user.email;
      if (!isRealAccount) {
        router.replace(`/login?redirect=${encodeURIComponent(`/join/${token}`)}`);
        return;
      }

      try {
        const response = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setState({
            status: "error",
            message: body.error || "Kunne ikke bli med på quizen",
          });
          return;
        }

        const { quizId } = await response.json();

        rememberPublicPlay(null);
        await activateQuiz.mutateAsync(quizId);
        useGameStore.setState({
          isHydrated: false,
          activeQuizId: null,
          isPlayingPublicQuiz: false,
        });

        toast({
          title: "Du har fått redigeringstilgang",
          description: "Endringer du gjør blir lagret sammen med eieren.",
        });
        router.replace("/setup");
      } catch {
        setState({
          status: "error",
          message: "Kunne ikke bli med på quizen. Prøv igjen.",
        });
      }
    };

    void run();
  }, [token, router, activateQuiz]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">
            {state.status === "working" ? "Blir med på quizen…" : "Fikk ikke tilgang"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
          {state.status === "working" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <p>{state.message}</p>
              <Button asChild>
                <Link href="/quizzes">Til biblioteket</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
