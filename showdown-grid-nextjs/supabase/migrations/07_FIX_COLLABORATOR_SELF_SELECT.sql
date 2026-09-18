-- Migration: Let a collaborator see their own row in quiz_collaborators
--
-- The SELECT policy from 05/06 only let the quiz OWNER read rows on
-- quiz_collaborators ("is_quiz_owner(quiz_id)"). It never let the
-- collaborator themselves read their own membership row.
--
-- join_quiz_by_token() inserts that row via SECURITY DEFINER, so it bypasses
-- RLS and always succeeds. But every read AFTER that goes through the normal
-- client and hits RLS:
--   - POST /api/quizzes/[id]/activate re-checks quiz_collaborators for the
--     caller's own row before letting them activate the quiz they were just
--     added to -- blocked, so joining a link always failed one step after
--     the row was actually created.
--   - GET /api/quiz's canEdit computation does the same self-check.
--   - GET /api/quizzes' "which quizzes am I a collaborator on" query is
--     filtered by user_id = auth.uid() -- also blocked, so a shared quiz
--     never appeared in the collaborator's own "Mine quizzer" list.
--
-- Fix: a row is visible to its own user_id, in addition to the quiz owner.

DROP POLICY IF EXISTS "Owners can view collaborators on their quizzes" ON quiz_collaborators;
CREATE POLICY "Owner or the collaborator themselves can view the row"
  ON quiz_collaborators FOR SELECT
  USING (auth.uid() = user_id OR is_quiz_owner(quiz_id));
