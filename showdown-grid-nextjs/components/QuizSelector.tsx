"use client";

import { Button } from "@/components/ui/button";
import { Library } from "lucide-react";
import { useRouter } from "next/navigation";

export function QuizSelector() {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push("/quizzes")}
      title="Administrer quizzer"
      className="gap-2"
    >
      <Library className="h-4 w-4" />
      Mine Quizzer
    </Button>
  );
}
