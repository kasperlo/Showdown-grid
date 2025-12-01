-- Simplified script to restore only missing constraints
-- Run this in DEV database SQL editor

-- ============================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Quizzes -> auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_user_id_fkey'
  ) THEN
    ALTER TABLE quizzes
      ADD CONSTRAINT quizzes_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Users -> auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_user_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Users -> quizzes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_active_quiz_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_active_quiz_id_fkey
      FOREIGN KEY (active_quiz_id)
      REFERENCES quizzes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Quiz_runs -> quizzes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_runs_quiz_id_fkey'
  ) THEN
    ALTER TABLE quiz_runs
      ADD CONSTRAINT quiz_runs_quiz_id_fkey
      FOREIGN KEY (quiz_id)
      REFERENCES quizzes(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Quiz_runs -> auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_runs_user_id_fkey'
  ) THEN
    ALTER TABLE quiz_runs
      ADD CONSTRAINT quiz_runs_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- ENABLE RLS (if not already enabled)
-- ============================================

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_runs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS quizzes_is_public_idx ON quizzes(is_public);
CREATE INDEX IF NOT EXISTS quiz_runs_user_id_idx ON quiz_runs(user_id);
CREATE INDEX IF NOT EXISTS quiz_runs_quiz_id_idx ON quiz_runs(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_runs_ended_at_idx ON quiz_runs(ended_at DESC);
CREATE INDEX IF NOT EXISTS quiz_runs_user_ended_idx ON quiz_runs(user_id, ended_at DESC);

-- Done!
SELECT 'Constraints restored successfully!' as status;
