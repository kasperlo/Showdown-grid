import { useState, useEffect, useCallback } from 'react';
import type { QuizMetadata } from '@/utils/types';

interface UsePublicQuizzesReturn {
  publicQuizzes: QuizMetadata[];
  isLoadingPublic: boolean;
  refreshPublicQuizzes: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing public quizzes
 */
export function usePublicQuizzes(): UsePublicQuizzesReturn {
  const [publicQuizzes, setPublicQuizzes] = useState<QuizMetadata[]>([]);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);

  const loadPublicQuizzes = useCallback(async () => {
    setIsLoadingPublic(true);
    try {
      const response = await fetch('/api/quizzes/public');
      if (response.ok) {
        const { quizzes } = await response.json();
        setPublicQuizzes(quizzes);
      }
    } catch (error) {
      console.error('Failed to load public quizzes:', error);
    } finally {
      setIsLoadingPublic(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadPublicQuizzes();
  }, [loadPublicQuizzes]);

  return {
    publicQuizzes,
    isLoadingPublic,
    refreshPublicQuizzes: loadPublicQuizzes,
  };
}



