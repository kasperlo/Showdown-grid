-- Migration: Only the owner decides who owns a quiz and how it is shared
--
-- The UPDATE policy from 05/06 lets a collaborator update the whole row, and
-- RLS cannot limit an update to some columns. So anyone who had joined
-- through a share link could set user_id to themselves and take the quiz
-- away from its owner, mint a new share token, or publish the quiz.
--
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION quizzes_guard_owner_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- No signed-in user: the service role or the SQL editor, which keep full
  -- control.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'the owner of a quiz cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.user_id
     AND (NEW.share_token IS DISTINCT FROM OLD.share_token
          OR NEW.is_public IS DISTINCT FROM OLD.is_public) THEN
    RAISE EXCEPTION 'only the owner can change how a quiz is shared'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quizzes_guard_owner_columns ON quizzes;
CREATE TRIGGER quizzes_guard_owner_columns
  BEFORE UPDATE ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION quizzes_guard_owner_columns();
