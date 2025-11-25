-- Migration: Add Timer and Theme Support
-- Adds time limit and theme customization to quizzes

-- Add new columns to quizzes table
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'classic';

-- Create index for theme filtering (optional, for future features)
CREATE INDEX IF NOT EXISTS quizzes_theme_idx ON quizzes(theme);

-- Update existing quizzes to have default theme
UPDATE quizzes
SET theme = 'classic'
WHERE theme IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN quizzes.time_limit IS 'Time limit for questions in seconds. NULL means no time limit.';
COMMENT ON COLUMN quizzes.theme IS 'Visual theme for the quiz: classic, sunset, forest, neon, or christmas';
