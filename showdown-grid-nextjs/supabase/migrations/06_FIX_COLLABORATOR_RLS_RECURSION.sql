-- Migration: Fix infinite RLS recursion introduced by 05
--
-- quizzes' SELECT/UPDATE policies subquery quiz_collaborators, and
-- quiz_collaborators' policies subquery quizzes right back. A subquery on a
-- table always re-evaluates that table's own RLS policies, so the two kept
-- calling each other forever: "infinite recursion detected in policy for
-- relation quizzes" (42P17), breaking every quiz read in production.
--
-- Fix: move each cross-table check into a SECURITY DEFINER function. Such a
-- function runs as its owner (the role that ran this migration, which has
-- BYPASSRLS in Supabase's SQL editor), so its internal query does not
-- re-trigger RLS on the table it reads — the recursion has nowhere to go.

CREATE OR REPLACE FUNCTION is_quiz_collaborator(p_quiz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quiz_collaborators
    WHERE quiz_id = p_quiz_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION is_quiz_collaborator(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_quiz_collaborator(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION is_quiz_owner(p_quiz_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quizzes
    WHERE id = p_quiz_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION is_quiz_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_quiz_owner(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view their own quizzes" ON quizzes;
CREATE POLICY "Users can view their own quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() = user_id OR is_quiz_collaborator(id));

DROP POLICY IF EXISTS "Users can update their own quizzes" ON quizzes;
CREATE POLICY "Users can update their own quizzes"
  ON quizzes FOR UPDATE
  USING (auth.uid() = user_id OR is_quiz_collaborator(id))
  WITH CHECK (auth.uid() = user_id OR is_quiz_collaborator(id));

DROP POLICY IF EXISTS "Owners can view collaborators on their quizzes" ON quiz_collaborators;
CREATE POLICY "Owners can view collaborators on their quizzes"
  ON quiz_collaborators FOR SELECT
  USING (is_quiz_owner(quiz_id));

DROP POLICY IF EXISTS "Owners can remove collaborators from their quizzes" ON quiz_collaborators;
CREATE POLICY "Owners can remove collaborators from their quizzes"
  ON quiz_collaborators FOR DELETE
  USING (is_quiz_owner(quiz_id));
