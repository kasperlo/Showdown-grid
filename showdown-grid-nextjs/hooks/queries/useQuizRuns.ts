import { useQuery } from "@tanstack/react-query";
import type { QuizRun, QuizRunSummary } from "@/utils/types";

// Query keys
export const quizRunKeys = {
  all: ["quiz-runs"] as const,
  lists: () => [...quizRunKeys.all, "list"] as const,
  list: (filters: { quizId?: string; limit?: number }) =>
    [...quizRunKeys.lists(), filters] as const,
  details: () => [...quizRunKeys.all, "detail"] as const,
  detail: (id: string) => [...quizRunKeys.details(), id] as const,
  active: (quizId: string) => [...quizRunKeys.all, "active", quizId] as const,
};

// Types
interface QuizRunsResponse {
  runs: QuizRunSummary[];
}

interface QuizRunResponse {
  run: QuizRun;
}

interface ActiveRunResponse {
  run: QuizRun;
}

// Fetch functions
async function fetchQuizRuns(
  quizId?: string,
  limit: number = 50
): Promise<QuizRunSummary[]> {
  const params = new URLSearchParams();
  if (quizId) params.set("quizId", quizId);
  params.set("limit", limit.toString());

  const response = await fetch(`/api/quiz-runs?${params.toString()}`);

  if (response.status === 401) {
    return []; // Not authenticated, return empty array
  }

  if (!response.ok) {
    throw new Error("Failed to load quiz runs");
  }

  const result: QuizRunsResponse = await response.json();
  return result.runs || [];
}

async function fetchActiveRun(quizId: string): Promise<QuizRun | null> {
  const response = await fetch(`/api/quiz-runs/active?quizId=${quizId}`);

  if (response.status === 404) {
    return null; // No active session found
  }

  if (response.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error("Failed to load active session");
  }

  const result: ActiveRunResponse = await response.json();
  return result.run;
}

async function fetchQuizRun(runId: string): Promise<QuizRun> {
  const response = await fetch(`/api/quiz-runs/${runId}`);

  if (response.status === 404) {
    throw new Error("Quiz run not found");
  }

  if (response.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error("Failed to load quiz run");
  }

  const result: QuizRunResponse = await response.json();
  return result.run;
}

// Query hooks
export function useQuizRuns(quizId?: string, limit: number = 50) {
  return useQuery({
    queryKey: quizRunKeys.list({ quizId, limit }),
    queryFn: () => fetchQuizRuns(quizId, limit),
    retry: (failureCount: number, error: unknown) => {
      // Don't retry on 401
      if (error instanceof Error && error.message === "Unauthorized") {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useActiveRun(quizId: string | null) {
  return useQuery({
    queryKey: quizRunKeys.active(quizId!),
    queryFn: () => fetchActiveRun(quizId!),
    enabled: !!quizId, // Only fetch if quizId is provided
    retry: (failureCount: number, error: unknown) => {
      // Don't retry on 404 or 401
      if (
        error instanceof Error &&
        (error.message === "Unauthorized" || error.message.includes("404"))
      ) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useQuizRun(runId: string | null) {
  return useQuery({
    queryKey: quizRunKeys.detail(runId!),
    queryFn: () => fetchQuizRun(runId!),
    enabled: !!runId, // Only fetch if runId is provided
    retry: (failureCount: number, error: unknown) => {
      // Don't retry on 404 or 401
      if (
        error instanceof Error &&
        (error.message === "Quiz run not found" ||
          error.message === "Unauthorized")
      ) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
