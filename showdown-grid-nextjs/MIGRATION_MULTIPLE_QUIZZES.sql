-- Migration: Support Multiple Quizzes Per User
-- This migration creates a new 'quizzes' table to replace 'user_quizzes'
-- and migrates existing data while maintaining backward compatibility

-- Step 1: Create new quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Min Quiz',
  description TEXT DEFAULT 'En Jeopardy-stil quiz',
  quiz_data JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable Row Level Security
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS Policies
CREATE POLICY "Users can read own quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quizzes"
  ON quizzes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quizzes"
  ON quizzes FOR DELETE
  USING (auth.uid() = user_id);

-- Step 4: Create indexes for performance
CREATE INDEX quizzes_user_id_idx ON quizzes(user_id);
CREATE INDEX quizzes_user_id_active_idx ON quizzes(user_id, is_active);

-- Step 5: Migrate existing data from user_quizzes to quizzes
-- Only run if user_quizzes table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_quizzes') THEN
    INSERT INTO quizzes (user_id, title, description, quiz_data, is_active, created_at, updated_at)
    SELECT
      user_id,
      COALESCE((quiz_data->>'quizTitle')::TEXT, 'Min Quiz'),
      COALESCE((quiz_data->>'quizDescription')::TEXT, 'En Jeopardy-stil quiz'),
      quiz_data,
      true, -- Set existing quiz as active
      created_at,
      updated_at
    FROM user_quizzes
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Migration completed: Existing quizzes migrated to new table';
  ELSE
    RAISE NOTICE 'No user_quizzes table found, skipping migration';
  END IF;
END $$;

-- Step 6: Create trigger to ensure only one active quiz per user
CREATE OR REPLACE FUNCTION ensure_single_active_quiz()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other quizzes for this user
    UPDATE quizzes
    SET is_active = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_active_quiz
  BEFORE INSERT OR UPDATE ON quizzes
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_quiz();

-- Step 7: Optional - Drop old table after confirming migration success
-- Uncomment the line below only after verifying the migration worked
-- DROP TABLE IF EXISTS user_quizzes CASCADE;
