import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizKeys } from "../queries/useQuizzes";
import type { QuizMetadata, QuizTemplate } from "@/utils/types";

interface CreateQuizData {
  title: string;
  description?: string;
  setAsActive?: boolean;
  /** Copy the board from another quiz the user can read. */
  copyFromQuizId?: string;
}

interface SaveTemplateData {
  quizId: string;
  template: QuizTemplate;
}

interface RenameQuizData {
  quizId: string;
  title: string;
  description?: string;
}

interface CreateQuizResponse {
  quiz: QuizMetadata;
}

async function createQuiz(data: CreateQuizData): Promise<QuizMetadata> {
  const response = await fetch("/api/quizzes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Kunne ikke opprette quiz" }));
    throw new Error(error.error || "Kunne ikke opprette quiz");
  }

  const result: CreateQuizResponse = await response.json();
  return result.quiz;
}

/**
 * Saves the board. Goes to PATCH /api/quizzes/[id] with template fields only —
 * the old POST /api/quiz took the whole game state and wrote scores and
 * answered questions into the quiz itself.
 */
async function saveTemplate({ quizId, template }: SaveTemplateData): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: template.quizTitle,
      description: template.quizDescription,
      timeLimit: template.quizTimeLimit,
      theme: template.quizTheme,
      isPublic: template.quizIsPublic,
      quizData: {
        categories: template.categories,
        teams: template.teams,
        jokerTimeLimit: template.jokerTimeLimit,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Lagring feilet (${response.status})`);
  }
}

async function renameQuiz({
  quizId,
  title,
  description,
}: RenameQuizData): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Kunne ikke endre navn");
  }
}

async function activateQuiz(quizId: string): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}/activate`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Kunne ikke bytte quiz");
  }
}

async function deleteQuiz(quizId: string): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Kunne ikke slette quiz");
  }
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuiz,
    onSuccess: (_data, variables) => {
      if (variables.setAsActive) {
        queryClient.invalidateQueries({ queryKey: quizKeys.active() });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveTemplate,
    onSuccess: () => {
      // The list shows title and counts, so it goes stale on every save. The
      // active-quiz query is deliberately NOT invalidated: refetching it mid-game
      // would overwrite the board the host is playing on.
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useRenameQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: renameQuiz,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
      queryClient.invalidateQueries({ queryKey: quizKeys.active() });
    },
  });
}

export function useActivateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateQuiz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.active() });
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteQuiz,
    onMutate: async (quizId) => {
      await queryClient.cancelQueries({ queryKey: quizKeys.lists() });
      const previousQuizzes = queryClient.getQueryData<QuizMetadata[]>(
        quizKeys.lists()
      );
      queryClient.setQueryData<QuizMetadata[]>(quizKeys.lists(), (old = []) =>
        old.filter((quiz) => quiz.id !== quizId)
      );
      return { previousQuizzes };
    },
    onError: (_err, _quizId, context) => {
      if (context?.previousQuizzes) {
        queryClient.setQueryData(quizKeys.lists(), context.previousQuizzes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
      queryClient.invalidateQueries({ queryKey: quizKeys.active() });
    },
  });
}
