-- Migration: One live session per quiz, and history that outlives the quiz
--
-- 1. Two devices opening their first card at the same moment could both
--    insert a live run for the same quiz. The loser stayed active forever and
--    came back as "En økt pågår allerede" later. Existing duplicates are
--    closed (the newest stays live), then a unique index stops new ones.
-- 2. quiz_runs.quiz_id was ON DELETE CASCADE, so deleting a quiz deleted the
--    history of every night it was played, including other players' runs of
--    a public quiz. The run keeps its own title and results, so it can stand
--    without the quiz.
--
-- Safe to run more than once.

UPDATE quiz_runs r
SET ended_at = COALESCE(r.updated_at, r.started_at),
    duration_seconds = GREATEST(
      0,
      EXTRACT(EPOCH FROM (COALESCE(r.updated_at, r.started_at) - r.started_at))::INTEGER
    )
WHERE r.ended_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM quiz_runs newer
    WHERE newer.user_id = r.user_id
      AND newer.quiz_id = r.quiz_id
      AND newer.ended_at IS NULL
      AND (newer.started_at > r.started_at
           OR (newer.started_at = r.started_at AND newer.id > r.id))
  );

CREATE UNIQUE INDEX IF NOT EXISTS quiz_runs_one_active_per_quiz
  ON quiz_runs(user_id, quiz_id)
  WHERE ended_at IS NULL;

ALTER TABLE quiz_runs ALTER COLUMN quiz_id DROP NOT NULL;
ALTER TABLE quiz_runs DROP CONSTRAINT IF EXISTS quiz_runs_quiz_id_fkey;
ALTER TABLE quiz_runs
  ADD CONSTRAINT quiz_runs_quiz_id_fkey
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL;
