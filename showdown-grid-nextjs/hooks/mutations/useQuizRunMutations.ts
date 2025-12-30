import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizRunKeys } from "../queries/useQuizRuns";
import type { QuizRun, QuizRunSummary, QuizRunFinalState } from "@/utils/types";

// Types
interface StartSessionData {
  quizId: string;
  startedAt: string;
  finalState: QuizRunFinalState;
}

interface CompleteSessionData {
  runId: string;
  quizId: string; // Added to fix race condition - needed to get active run
  finalState: QuizRunFinalState;
}

interface StartSessionResponse {
  run: QuizRun;
}

interface CompleteSessionResponse {
  run: QuizRun;
}

// Mutation functions
async function startSession(data: StartSessionData): Promise<QuizRun> {
  const response = await fetch("/api/quiz-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quizId: data.quizId,
      startedAt: data.startedAt,
      finalState: data.finalState,
      // No endedAt for live sessions
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to start session");
  }

  const result: StartSessionResponse = await response.json();
  return result.run;
}

async function completeSession(data: CompleteSessionData): Promise<QuizRun> {
  const response = await fetch(`/api/quiz-runs/${data.runId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      finalState: data.finalState,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to complete session");
  }

  const result: CompleteSessionResponse = await response.json();
  return result.run;
}

async function deleteRun(runId: string): Promise<void> {
  const response = await fetch(`/api/quiz-runs/${runId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete run");
  }
}

// Mutation hooks
export function useStartSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startSession,
    onMutate: async (newSession) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: quizRunKeys.active(newSession.quizId),
      });

      // Snapshot previous value
      const previousActiveRun = queryClient.getQueryData<QuizRun | null>(
        quizRunKeys.active(newSession.quizId)
      );

      // Optimistically create the session
      const optimisticRun: QuizRun = {
        id: `temp-${Date.now()}`,
        quiz_id: newSession.quizId,
        user_id: "", // Will be filled by server
        started_at: newSession.startedAt,
        ended_at: null,
        duration_seconds: null,
        quiz_title: "",
        quiz_description: null,
        quiz_theme: null,
        quiz_time_limit: null,
        final_state: newSession.finalState,
        total_questions: 0,
        answered_questions: 0,
        completion_percentage: 0,
        team_results: [],
        winning_team_name: null,
        winning_score: null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData(
        quizRunKeys.active(newSession.quizId),
        optimisticRun
      );

      return { previousActiveRun };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousActiveRun !== undefined) {
        queryClient.setQueryData(
          quizRunKeys.active(variables.quizId),
          context.previousActiveRun
        );
      }
    },
    onSuccess: (data, variables) => {
      // Update with real data from server
      queryClient.setQueryData(quizRunKeys.active(variables.quizId), data);
    },
    onSettled: (data, error, variables) => {
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: quizRunKeys.active(variables.quizId),
      });
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeSession,
    onMutate: async (data) => {
      // Use quizId from data parameter (fixes race condition)
      const { quizId } = data;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: quizRunKeys.lists() });
      await queryClient.cancelQueries({ queryKey: quizRunKeys.active(quizId) });

      // Snapshot previous values
      const previousRuns = queryClient.getQueryData<QuizRunSummary[]>(
        quizRunKeys.lists()
      );
      const previousActiveRun = queryClient.getQueryData<QuizRun>(
        quizRunKeys.active(quizId)
      );

      // Optimistically clear active run since it's being completed
      queryClient.setQueryData(quizRunKeys.active(quizId), null);

      return { previousRuns, previousActiveRun, quizId };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousRuns) {
        queryClient.setQueryData(quizRunKeys.lists(), context.previousRuns);
      }
      if (context?.previousActiveRun && context.quizId) {
        queryClient.setQueryData(
          quizRunKeys.active(context.quizId),
          context.previousActiveRun
        );
      }
    },
    onSuccess: (data) => {
      // Add completed run to the list optimistically
      const completedSummary: QuizRunSummary = {
        id: data.id,
        quiz_title: data.quiz_title,
        ended_at: data.ended_at!,
        duration_seconds: data.duration_seconds!,
        total_questions: data.total_questions,
        answered_questions: data.answered_questions,
        completion_percentage: data.completion_percentage,
        winning_team_name: data.winning_team_name,
        winning_score: data.winning_score,
      };

      queryClient.setQueryData<QuizRunSummary[]>(
        quizRunKeys.lists(),
        (old = []) => [completedSummary, ...old]
      );
    },
    onSettled: (data, error, variables, context) => {
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: quizRunKeys.lists() });
      if (context?.quizId) {
        queryClient.invalidateQueries({
          queryKey: quizRunKeys.active(context.quizId),
        });
      }
    },
  });
}

export function useDeleteRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRun,
    onMutate: async (runId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: quizRunKeys.lists() });

      // Snapshot previous value
      const previousRuns = queryClient.getQueryData<QuizRunSummary[]>(
        quizRunKeys.lists()
      );

      // Optimistically remove from list
      queryClient.setQueryData<QuizRunSummary[]>(
        quizRunKeys.lists(),
        (old = []) => old.filter((run) => run.id !== runId)
      );

      return { previousRuns };
    },
    onError: (err, runId, context) => {
      // Rollback on error
      if (context?.previousRuns) {
        queryClient.setQueryData(quizRunKeys.lists(), context.previousRuns);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: quizRunKeys.lists() });
    },
  });
}
