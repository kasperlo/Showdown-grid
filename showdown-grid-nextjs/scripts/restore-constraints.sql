-- Script to restore all constraints and policies after manual data import
-- Run this in DEV database SQL editor after importing data

-- ============================================
-- QUIZZES TABLE
-- ============================================

-- Add foreign key constraint to auth.users
ALTER TABLE quizzes
  DROP CONSTRAINT IF EXISTS quizzes_user_id_fkey;

ALTER TABLE quizzes
  ADD CONSTRAINT quizzes_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (in case they exist)
DROP POLICY IF EXISTS "Users can view their own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Anyone can view public quizzes" ON quizzes;
DROP POLICY IF EXISTS "Users can insert their own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Users can update their own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Users can delete their own quizzes" ON quizzes;

-- Create RLS policies for quizzes
CREATE POLICY "Users can view their own quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public quizzes"
  ON quizzes FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can insert their own quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quizzes"
  ON quizzes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quizzes"
  ON quizzes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- USERS TABLE
-- ============================================

-- Add foreign key constraints
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_user_id_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_active_quiz_id_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_active_quiz_id_fkey
  FOREIGN KEY (active_quiz_id)
  REFERENCES quizzes(id)
  ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read own data" ON users;
  DROP POLICY IF EXISTS "Users can insert own data" ON users;
  DROP POLICY IF EXISTS "Users can update own data" ON users;
  DROP POLICY IF EXISTS "Users can delete own data" ON users;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if policies don't exist
  NULL;
END $$;

-- Create RLS policies for users (with IF NOT EXISTS logic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'Users can read own data'
  ) THEN
    CREATE POLICY "Users can read own data"
      ON users FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'Users can insert own data'
  ) THEN
    CREATE POLICY "Users can insert own data"
      ON users FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'Users can update own data'
  ) THEN
    CREATE POLICY "Users can update own data"
      ON users FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'Users can delete own data'
  ) THEN
    CREATE POLICY "Users can delete own data"
      ON users FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- QUIZ_RUNS TABLE
-- ============================================

-- Add foreign key constraints
ALTER TABLE quiz_runs
  DROP CONSTRAINT IF EXISTS quiz_runs_quiz_id_fkey;

ALTER TABLE quiz_runs
  ADD CONSTRAINT quiz_runs_quiz_id_fkey
  FOREIGN KEY (quiz_id)
  REFERENCES quizzes(id)
  ON DELETE CASCADE;

ALTER TABLE quiz_runs
  DROP CONSTRAINT IF EXISTS quiz_runs_user_id_fkey;

ALTER TABLE quiz_runs
  ADD CONSTRAINT quiz_runs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE quiz_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own quiz runs" ON quiz_runs;
DROP POLICY IF EXISTS "Users can insert own quiz runs" ON quiz_runs;
DROP POLICY IF EXISTS "Users can update own quiz runs" ON quiz_runs;
DROP POLICY IF EXISTS "Users can delete own quiz runs" ON quiz_runs;

-- Create RLS policies for quiz_runs
CREATE POLICY "Users can read own quiz runs"
  ON quiz_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz runs"
  ON quiz_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz runs"
  ON quiz_runs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quiz runs"
  ON quiz_runs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS quizzes_is_public_idx ON quizzes(is_public);
CREATE INDEX IF NOT EXISTS quiz_runs_user_id_idx ON quiz_runs(user_id);
CREATE INDEX IF NOT EXISTS quiz_runs_quiz_id_idx ON quiz_runs(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_runs_ended_at_idx ON quiz_runs(ended_at DESC);
CREATE INDEX IF NOT EXISTS quiz_runs_user_ended_idx ON quiz_runs(user_id, ended_at DESC);

-- Done!
SELECT 'All constraints and policies have been restored!' as status;
