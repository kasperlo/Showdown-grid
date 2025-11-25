-- Add is_public column to quizzes table
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on public quizzes
CREATE INDEX IF NOT EXISTS quizzes_is_public_idx ON quizzes(is_public);

-- Drop all existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "Users can view their own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Anyone can view public quizzes" ON quizzes;
DROP POLICY IF EXISTS "Users can insert their own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Users can update their own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Users can delete their own quizzes" ON quizzes;

-- SELECT policies: Users can view their own quizzes OR public quizzes
CREATE POLICY "Users can view their own quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public quizzes"
  ON quizzes FOR SELECT
  USING (is_public = true);

-- INSERT policy: Only authenticated users can create quizzes
CREATE POLICY "Users can insert their own quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: Only owners can update their own quizzes
CREATE POLICY "Users can update their own quizzes"
  ON quizzes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy: Only owners can delete their own quizzes
CREATE POLICY "Users can delete their own quizzes"
  ON quizzes FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON COLUMN quizzes.is_public IS 'If true, this quiz is visible to all users in the public gallery (read-only for non-owners)';
