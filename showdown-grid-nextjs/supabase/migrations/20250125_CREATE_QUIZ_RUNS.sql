-- Migration: Create quiz_runs table for quiz session history and statistics
-- This migration creates a new table to store completed quiz sessions
-- allowing users to view history and statistics over time

-- Step 1: Create quiz_runs table
CREATE TABLE IF NOT EXISTS quiz_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,

  -- Quiz snapshot (metadata at time of run)
  quiz_title TEXT NOT NULL,
  quiz_description TEXT,
  quiz_theme TEXT,
  quiz_time_limit INTEGER,

  -- Final state snapshot
  final_state JSONB NOT NULL,
  -- Structure: { categories: Category[], teams: Team[], adjustmentLog: AdjustmentEntry[] }

  -- Aggregated statistics (denormalized for performance)
  total_questions INTEGER NOT NULL,
  answered_questions INTEGER NOT NULL,
  completion_percentage INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN total_questions > 0 THEN (answered_questions * 100 / total_questions)
      ELSE 0
    END
  ) STORED,

  -- Team results (denormalized for fast queries)
  team_results JSONB NOT NULL,
  -- Structure: [{ teamId, teamName, finalScore, rank }]

  -- Winner info (denormalized for list views)
  winning_team_name TEXT,
  winning_score INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX quiz_runs_user_id_idx ON quiz_runs(user_id);
CREATE INDEX quiz_runs_quiz_id_idx ON quiz_runs(quiz_id);
CREATE INDEX quiz_runs_ended_at_idx ON quiz_runs(ended_at DESC);
CREATE INDEX quiz_runs_user_ended_idx ON quiz_runs(user_id, ended_at DESC);

-- Step 3: Enable Row Level Security
ALTER TABLE quiz_runs ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies
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

-- Step 5: Add comments for documentation
COMMENT ON TABLE quiz_runs IS 'Stores completed quiz sessions for history and statistics';
COMMENT ON COLUMN quiz_runs.final_state IS 'Complete snapshot of quiz state at end of session';
COMMENT ON COLUMN quiz_runs.team_results IS 'Denormalized team results for fast list queries';
COMMENT ON COLUMN quiz_runs.completion_percentage IS 'Auto-calculated percentage of questions answered';
