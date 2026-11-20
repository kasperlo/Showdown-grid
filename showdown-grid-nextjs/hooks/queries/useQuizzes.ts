import { useQuery } from "@tanstack/react-query";
import type { QuizMetadata } from "@/utils/types";

// Query keys
export const quizKeys = {
  all: ["quizzes"] as const,
  lists: () => [...quizKeys.all, "list"] as const,
  list: (filters: string) => [...quizKeys.lists(), { filters }] as const,
  details: () => [...quizKeys.all, "detail"] as const,
  detail: (id: string) => [...quizKeys.details(), id] as const,
  public: () => [...quizKeys.all, "public"] as const,
  share: (quizId: string) => [...quizKeys.all, "share", quizId] as const,
};

// Types
interface QuizListResponse {
  quizzes: QuizMetadata[];
}

interface PublicQuizzesResponse {
  quizzes: QuizMetadata[];
}

export interface ShareCollaborator {
  userId: string;
  email: string;
  createdAt: string;
}

export interface ShareStatus {
  shareToken: string | null;
  collaborators: ShareCollaborator[];
}

// Fetch functions
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

async function fetchShareStatus(quizId: string): Promise<ShareStatus> {
  const response = await fetch(`/api/quizzes/${quizId}/share`);
  if (!response.ok) {
    throw new Error("Kunne ikke laste delingsstatus");
  }
  return response.json();
}

// Query hooks
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

export function useShareStatus(quizId: string | null) {
  return useQuery({
    queryKey: quizKeys.share(quizId ?? ""),
    queryFn: () => fetchShareStatus(quizId as string),
    enabled: Boolean(quizId),
  });
}
