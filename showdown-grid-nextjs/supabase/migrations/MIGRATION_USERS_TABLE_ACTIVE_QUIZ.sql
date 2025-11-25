-- Migration: Replace is_active with users table
-- This migration creates a 'users' table to track each user's active quiz
-- and removes the is_active boolean from quizzes table

-- Step 1: Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS Policies for users table
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON users FOR DELETE
  USING (auth.uid() = user_id);

-- Step 4: Migrate existing data
-- Populate users table with active quiz data from quizzes
INSERT INTO users (user_id, active_quiz_id, created_at, updated_at)
SELECT DISTINCT
  user_id,
  (SELECT id FROM quizzes q WHERE q.user_id = quizzes.user_id AND q.is_active = true LIMIT 1),
  NOW(),
  NOW()
FROM quizzes
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Step 5: Drop the trigger and function for is_active
DROP TRIGGER IF EXISTS trigger_ensure_single_active_quiz ON quizzes;
DROP FUNCTION IF EXISTS ensure_single_active_quiz();

-- Step 6: Drop the is_active index
DROP INDEX IF EXISTS quizzes_user_id_active_idx;

-- Step 7: Remove is_active column from quizzes
ALTER TABLE quizzes DROP COLUMN IF EXISTS is_active;

-- Step 8: Add index for performance on users table
CREATE INDEX users_active_quiz_idx ON users(active_quiz_id);

COMMENT ON TABLE users IS 'Tracks user preferences including their currently active quiz';
COMMENT ON COLUMN users.active_quiz_id IS 'The quiz currently active for this user. NULL means no active quiz.';

