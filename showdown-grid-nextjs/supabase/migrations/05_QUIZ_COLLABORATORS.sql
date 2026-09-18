-- Migration: Shared edit access via link
-- Adds a per-quiz share token and a collaborators table. Anyone who joins
-- through the link becomes a full editor (same rights as the owner, minus
-- delete and share management).

-- Step 1: Share token on the quiz itself. NULL means sharing is off.
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE;

COMMENT ON COLUMN quizzes.share_token IS
  'Non-null enables the edit-access join link at /join/<token>. Set to NULL to turn the link off without removing existing collaborators.';

-- Step 2: Collaborators table
CREATE TABLE IF NOT EXISTS quiz_collaborators (
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, user_id)
);

CREATE INDEX IF NOT EXISTS quiz_collaborators_user_id_idx
  ON quiz_collaborators(user_id);

ALTER TABLE quiz_collaborators ENABLE ROW LEVEL SECURITY;

-- Only the owner can see or manage the collaborator list directly. Joining
-- happens through join_quiz_by_token() below, not through a client-side
-- INSERT policy — a policy that let a user insert their own row would let
-- anyone who can read a quiz id add themselves as an editor with no token
-- check at all.
CREATE POLICY "Owners can view collaborators on their quizzes"
  ON quiz_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_collaborators.quiz_id AND q.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can remove collaborators from their quizzes"
  ON quiz_collaborators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_collaborators.quiz_id AND q.user_id = auth.uid()
    )
  );

-- Step 3: Extend the existing owner-only quizzes policies to collaborators
DROP POLICY IF EXISTS "Users can view their own quizzes" ON quizzes;
CREATE POLICY "Users can view their own quizzes"
  ON quizzes FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM quiz_collaborators c
      WHERE c.quiz_id = quizzes.id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own quizzes" ON quizzes;
CREATE POLICY "Users can update their own quizzes"
  ON quizzes FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM quiz_collaborators c
      WHERE c.quiz_id = quizzes.id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM quiz_collaborators c
      WHERE c.quiz_id = quizzes.id AND c.user_id = auth.uid()
    )
  );

-- DELETE stays owner-only (unchanged, not recreated here).

-- Step 4: join_quiz_by_token — the only way a collaborator row is created.
-- SECURITY DEFINER lets it read quizzes.share_token for a caller who is not
-- yet a collaborator (RLS above would otherwise hide the row from them) and
-- insert their own membership row, without handing the app a service-role key.
CREATE OR REPLACE FUNCTION join_quiz_by_token(p_token UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_id UUID;
  v_owner_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT id, user_id INTO v_quiz_id, v_owner_id
  FROM quizzes
  WHERE share_token = p_token;

  IF v_quiz_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF v_owner_id = auth.uid() THEN
    RETURN v_quiz_id;
  END IF;

  INSERT INTO quiz_collaborators (quiz_id, user_id)
  VALUES (v_quiz_id, auth.uid())
  ON CONFLICT (quiz_id, user_id) DO NOTHING;

  RETURN v_quiz_id;
END;
$$;

REVOKE ALL ON FUNCTION join_quiz_by_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_quiz_by_token(UUID) TO authenticated;

-- Step 5: get_quiz_collaborators — lets the owner see who has edit access,
-- with an email to show. auth.users is not otherwise readable from the
-- client, and only the calling owner's own quiz is exposed.
CREATE OR REPLACE FUNCTION get_quiz_collaborators(p_quiz_id UUID)
RETURNS TABLE(user_id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM quizzes q WHERE q.id = p_quiz_id AND q.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT c.user_id, u.email::TEXT, c.created_at
  FROM quiz_collaborators c
  JOIN auth.users u ON u.id = c.user_id
  WHERE c.quiz_id = p_quiz_id
  ORDER BY c.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_quiz_collaborators(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_quiz_collaborators(UUID) TO authenticated;
