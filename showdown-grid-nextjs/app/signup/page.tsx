"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !password || !confirmPassword) {
      setError("Alle felt må fylles ut");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passordene matcher ikke");
      return;
    }

    if (password.length < 6) {
      setError("Passordet må være minst 6 tegn");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // Check if user is currently anonymous
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const isAnonymous = currentSession?.user?.is_anonymous;

      // Sign up
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log("[Signup] Result:", { data, error: signupError });

      if (signupError) {
        console.error("[Signup] Error:", signupError);
        setError(signupError.message);
        return;
      }

      if (!data.user) {
        console.error("[Signup] No user created");
        setError("Kunne ikke opprette bruker");
        return;
      }

      console.log("[Signup] User created:", data.user.id, "Session exists:", !!data.session);

      // Check if email confirmation is required
      // In production, Supabase often requires email confirmation before session is established
      const requiresEmailConfirmation =
        !data.session && !data.user.email_confirmed_at;

      console.log("[Signup] Email confirmation required:", requiresEmailConfirmation);

      if (requiresEmailConfirmation) {
        // Email confirmation required - show success message
        setError(null);
        console.warn("[Signup] E-postbekreftelse er påkrevd. Bruker må sjekke e-post.");
        toast({
          title: "Konto opprettet!",
          description:
            "Sjekk din e-post for bekreftelseslenken. Du kan logge inn etter at du har bekreftet e-posten din.",
        });

        // Show additional info in development
        if (process.env.NODE_ENV === 'development') {
          console.info(`
            ⚠️  E-POSTBEKREFTELSE ER AKTIVERT

            For å deaktivere i Supabase Dashboard:
            1. Gå til Authentication → Providers → Email
            2. Deaktiver "Confirm email"

            Alternativt: Sjekk e-posten din for bekreftelseslenken.
          `);
        }

        router.push("/onboarding");
        return;
      }

      // If user was anonymous, trigger data migration
      if (isAnonymous && currentSession) {
        try {
          const response = await fetch("/api/auth/migrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromUserId: currentSession.user.id,
              toUserId: data.user.id,
            }),
          });

          if (!response.ok) {
            console.error("Migration failed, but signup succeeded");
          }
        } catch (migrationError) {
          console.error("Migration error:", migrationError);
          // Don't block signup if migration fails
        }
      }

      // Session should exist if email confirmation is not required
      // But wait a bit for it to be established (especially in production)
      let sessionEstablished = false;
      const sessionToCheck = data.session;

      if (sessionToCheck) {
        // Session already exists from signup
        sessionEstablished = true;
      } else {
        // Poll for session (may take a moment in production)
        for (let i = 0; i < 30; i++) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            sessionEstablished = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!sessionEstablished) {
        setError("Kunne ikke etablere sesjon. Prøv å logge inn på nytt.");
        return;
      }

      // Redirect to home
      router.push("/");
      router.refresh();
    } catch (error: unknown) {
      console.error("Signup error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Noe gikk galt. Prøv igjen.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/onboarding">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Opprett konto</CardTitle>
            <CardDescription>
              Registrer deg for å få tilgang på tvers av enheter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="din@epost.no"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minst 6 tegn"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Bekreft passord</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Gjenta passordet"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Oppretter konto...
                  </>
                ) : (
                  "Opprett konto"
                )}
              </Button>

              <div className="text-center">
                <Link href="/onboarding">
                  <Button variant="link" type="button">
                    Eller fortsett som gjest
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
