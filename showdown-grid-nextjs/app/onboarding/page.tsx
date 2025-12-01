"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, User } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAnonymous = async () => {
    setIsLoading("anonymous");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously();

      if (error) {
        console.error("Anonymous sign-in error:", error);
        alert("Kunne ikke starte som gjest. Prøv igjen.");
        return;
      }

      // Mark that user has chosen auth method
      localStorage.setItem("auth-method-chosen", "true");
      
      // Wait for session to propagate
      await new Promise(resolve => setTimeout(resolve, 300));
      
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error during anonymous sign-in:", error);
      alert("Noe gikk galt. Prøv igjen.");
    } finally {
      setIsLoading(null);
    }
  };

  const handleSignup = () => {
    router.push("/signup");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-accent drop-shadow-lg mb-4">
            JEOPARTY 🥳
          </h1>
          <p className="text-xl text-muted-foreground">
            Velkommen til den ultimate quiz-opplevelsen
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Anonymous Option */}
          <Card className="border-2 hover:border-accent transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-accent/10 rounded-full">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">Kom i gang</CardTitle>
              </div>
              <CardDescription className="text-base">
                Start umiddelbart som gjest - ingen registrering nødvendig
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">✓</span>
                  <span>Full tilgang til alle funksjoner</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">✓</span>
                  <span>Lag og spill quizzer umiddelbart</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">✓</span>
                  <span>Auto-lagring av fremgang</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 mt-0.5">○</span>
                  <span className="text-muted-foreground/60">
                    Data lagres lokalt (kan oppgradere til konto senere)
                  </span>
                </li>
              </ul>
              <Button
                onClick={handleAnonymous}
                disabled={isLoading === "anonymous"}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6 text-lg"
                size="lg"
              >
                {isLoading === "anonymous" ? "Starter..." : "Start som gjest"}
              </Button>
            </CardContent>
          </Card>

          {/* Signup Option */}
          <Card className="border-2 hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-full">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Opprett konto</CardTitle>
              </div>
              <CardDescription className="text-base">
                Registrer deg for å få tilgang på tvers av enheter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Alle funksjoner som gjest</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Tilgang fra alle enheter</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Permanent lagring av quizzer og historikk</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Mulighet til å dele quizzer</span>
                </li>
              </ul>
              <Button
                onClick={handleSignup}
                variant="outline"
                className="w-full border-2 border-primary hover:bg-primary hover:text-primary-foreground font-semibold py-6 text-lg"
                size="lg"
              >
                Opprett konto
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Du kan alltid oppgradere fra gjest til registrert bruker senere
        </p>
      </div>
    </div>
  );
}

