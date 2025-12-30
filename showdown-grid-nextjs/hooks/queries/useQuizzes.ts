import { useQuery } from "@tanstack/react-query";
import type { QuizMetadata, Category, Team, AdjustmentEntry } from "@/utils/types";

// Query keys
export const quizKeys = {
  all: ["quizzes"] as const,
  lists: () => [...quizKeys.all, "list"] as const,
  list: (filters: string) => [...quizKeys.lists(), { filters }] as const,
  details: () => [...quizKeys.all, "detail"] as const,
  detail: (id: string) => [...quizKeys.details(), id] as const,
  active: () => [...quizKeys.all, "active"] as const,
  public: () => [...quizKeys.all, "public"] as const,
};

// Types
interface ActiveQuizData {
  quizId: string;
  quizOwnerId: string;
  quizTitle: string;
  quizDescription: string;
  quizTimeLimit: number | null;
  quizTheme: string;
  quizIsPublic: boolean;
  categories: Category[];
  teams: Team[];
  adjustmentLog: AdjustmentEntry[];
}

interface QuizListResponse {
  quizzes: QuizMetadata[];
}

interface PublicQuizzesResponse {
  quizzes: QuizMetadata[];
}

interface QuizDataResponse {
  data: ActiveQuizData;
}

// Fetch functions
async function fetchActiveQuiz(): Promise<ActiveQuizData | null> {
  const response = await fetch("/api/quiz");

  if (response.status === 404) {
    return null; // No active quiz found
  }

  if (response.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error(`Failed to load quiz: ${response.status}`);
  }

  const result: QuizDataResponse = await response.json();
  return result.data;
}

async function fetchQuizzesList(): Promise<QuizMetadata[]> {
  const response = await fetch("/api/quizzes");

  if (response.status === 401) {
    return []; // Not authenticated, return empty array
  }

  if (!response.ok) {
    throw new Error("Failed to load quizzes list");
  }

  const result: QuizListResponse = await response.json();
  return result.quizzes || [];
}

async function fetchPublicQuizzes(): Promise<QuizMetadata[]> {
  const response = await fetch("/api/quizzes/public");

  if (!response.ok) {
    throw new Error("Failed to load public quizzes");
  }

  const result: PublicQuizzesResponse = await response.json();
  return result.quizzes || [];
}

async function fetchQuiz(quizId: string): Promise<ActiveQuizData> {
  const response = await fetch(`/api/quizzes/${quizId}/load`);

  if (response.status === 404) {
    throw new Error("Quiz not found");
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error(`Failed to load quiz: ${response.status}`);
  }

  const result: QuizDataResponse = await response.json();
  return result.data;
}

// Query hooks
export function useActiveQuiz(enabled: boolean = true) {
  return useQuery({
    queryKey: quizKeys.active(),
    queryFn: fetchActiveQuiz,
    enabled, // Only fetch if enabled (false when playing public quiz)
    retry: (failureCount, error) => {
      // Don't retry on 401 or 404
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

export function useQuizzesList() {
  return useQuery({
    queryKey: quizKeys.lists(),
    queryFn: fetchQuizzesList,
    retry: (failureCount, error) => {
      // Don't retry on 401
      if (error instanceof Error && error.message === "Unauthorized") {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function usePublicQuizzes() {
  return useQuery({
    queryKey: quizKeys.public(),
    queryFn: fetchPublicQuizzes,
    staleTime: 2 * 60 * 1000, // Public quizzes can be cached longer
  });
}

export function useQuiz(quizId: string | null) {
  return useQuery({
    queryKey: quizKeys.detail(quizId!),
    queryFn: () => fetchQuiz(quizId!),
    enabled: !!quizId, // Only fetch if quizId is provided
    retry: (failureCount, error) => {
      // Don't retry on 404 or 401/403
      if (
        error instanceof Error &&
        (error.message === "Quiz not found" || error.message === "Unauthorized")
      ) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
