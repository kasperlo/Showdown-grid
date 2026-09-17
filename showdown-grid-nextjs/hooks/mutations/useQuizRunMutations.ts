import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizRunKeys } from "../queries/useQuizRuns";

/**
 * Only deleting a run goes through React Query. Starting, saving and completing
 * a session live in the store, because they have to work from the game itself —
 * including from a `pagehide` handler, where a hook is not available.
 */
async function deleteRun(runId: string): Promise<void> {
  const response = await fetch(`/api/quiz-runs/${runId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Kunne ikke slette økten");
  }
}

export function useDeleteRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRun,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: quizRunKeys.lists() });
    },
  });
}
