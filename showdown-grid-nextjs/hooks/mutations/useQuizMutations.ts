import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizKeys } from "../queries/useQuizzes";
import type { QuizMetadata } from "@/utils/types";

interface CreateQuizData {
  title: string;
  description?: string;
  setAsActive?: boolean;
  /** Copy the board from another quiz the user can read. */
  copyFromQuizId?: string;
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

async function enableSharing(quizId: string): Promise<string> {
  const response = await fetch(`/api/quizzes/${quizId}/share`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Kunne ikke aktivere deling");
  }

  const { shareToken } = await response.json();
  return shareToken;
}

async function disableSharing(quizId: string): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}/share`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Kunne ikke slå av deling");
  }
}

interface RemoveCollaboratorData {
  quizId: string;
  userId: string;
}

async function removeCollaborator({
  quizId,
  userId,
}: RemoveCollaboratorData): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}/collaborators/${userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Kunne ikke fjerne redaktøren");
  }
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuiz,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useActivateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateQuiz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useEnableSharing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: enableSharing,
    onSuccess: (_shareToken, quizId) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.share(quizId) });
    },
  });
}

export function useDisableSharing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disableSharing,
    onSuccess: (_data, quizId) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.share(quizId) });
    },
  });
}

export function useRemoveCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeCollaborator,
    onSuccess: (_data, { quizId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.share(quizId) });
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
    },
  });
}
