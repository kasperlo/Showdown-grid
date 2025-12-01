import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quizKeys } from '../queries/useQuizzes';
import type { QuizMetadata } from '@/utils/types';

// Types
interface CreateQuizData {
  title: string;
  description?: string;
  quizData?: any;
  setAsActive?: boolean;
}

interface UpdateQuizData {
  data: {
    categories: any[];
    teams: any[];
    quizTitle: string;
    quizDescription: string;
    quizTimeLimit: number | null;
    quizTheme: string;
    quizIsPublic: boolean;
    adjustmentLog: any[];
  };
}

interface CreateQuizResponse {
  quiz: QuizMetadata;
}

// Mutation functions
async function createQuiz(data: CreateQuizData): Promise<QuizMetadata> {
  const response = await fetch('/api/quizzes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create quiz' }));
    throw new Error(error.error || 'Failed to create quiz');
  }

  const result: CreateQuizResponse = await response.json();
  return result.quiz;
}

async function updateQuiz(data: UpdateQuizData): Promise<void> {
  const response = await fetch('/api/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update quiz');
  }
}

async function activateQuiz(quizId: string): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}/activate`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to activate quiz');
  }
}

async function deleteQuiz(quizId: string): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete quiz');
  }
}

// Mutation hooks
export function useCreateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuiz,
    onMutate: async (newQuiz) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: quizKeys.lists() });

      // Snapshot previous value
      const previousQuizzes = queryClient.getQueryData<QuizMetadata[]>(quizKeys.lists());

      // Optimistically update to the new value
      const optimisticQuiz: QuizMetadata = {
        id: `temp-${Date.now()}`,
        title: newQuiz.title,
        description: newQuiz.description || '',
        is_public: false,
        time_limit: null,
        theme: 'classic',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<QuizMetadata[]>(quizKeys.lists(), (old = []) => [
        optimisticQuiz,
        ...old,
      ]);

      return { previousQuizzes };
    },
    onError: (err, newQuiz, context) => {
      // Rollback on error
      if (context?.previousQuizzes) {
        queryClient.setQueryData(quizKeys.lists(), context.previousQuizzes);
      }
    },
    onSuccess: (data, variables) => {
      // If setAsActive, invalidate active quiz query
      if (variables.setAsActive) {
        queryClient.invalidateQueries({ queryKey: quizKeys.active() });
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useUpdateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateQuiz,
    onMutate: async (updatedData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: quizKeys.active() });

      // Snapshot previous value
      const previousQuiz = queryClient.getQueryData(quizKeys.active());

      // Optimistically update active quiz
      queryClient.setQueryData(quizKeys.active(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          ...updatedData.data,
        };
      });

      return { previousQuiz };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousQuiz) {
        queryClient.setQueryData(quizKeys.active(), context.previousQuiz);
      }
    },
    onSettled: () => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: quizKeys.active() });
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useActivateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateQuiz,
    onSuccess: () => {
      // Invalidate active quiz and list to refetch
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: quizKeys.lists() });

      // Snapshot previous value
      const previousQuizzes = queryClient.getQueryData<QuizMetadata[]>(quizKeys.lists());

      // Optimistically remove from list
      queryClient.setQueryData<QuizMetadata[]>(quizKeys.lists(), (old = []) =>
        old.filter((quiz) => quiz.id !== quizId)
      );

      return { previousQuizzes };
    },
    onError: (err, quizId, context) => {
      // Rollback on error
      if (context?.previousQuizzes) {
        queryClient.setQueryData(quizKeys.lists(), context.previousQuizzes);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
      // Also invalidate active quiz in case we deleted the active one
      queryClient.invalidateQueries({ queryKey: quizKeys.active() });
    },
  });
}

