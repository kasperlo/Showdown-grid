"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

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
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const isAnonymous = currentSession?.user?.is_anonymous;

      // Sign up
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      if (!data.user) {
        setError("Kunne ikke opprette bruker");
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

      // Mark that user has chosen auth method
      localStorage.setItem("auth-method-chosen", "true");

      // Wait for session to propagate
      await new Promise(resolve => setTimeout(resolve, 300));

      // Redirect to home
      router.push("/");
      router.refresh();
    } catch (error: any) {
      console.error("Signup error:", error);
      setError(error.message || "Noe gikk galt. Prøv igjen.");
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

