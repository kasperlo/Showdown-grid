-- Migration: Enable live sessions in quiz_runs table
-- This migration modifies quiz_runs to support live (ongoing) sessions
-- by making ended_at nullable and adding updated_at tracking

-- Step 1: Make ended_at nullable (for live sessions)
ALTER TABLE quiz_runs 
  ALTER COLUMN ended_at DROP NOT NULL;

-- Step 2: Make duration_seconds nullable (can't calculate without ended_at)
ALTER TABLE quiz_runs 
  ALTER COLUMN duration_seconds DROP NOT NULL;

-- Step 3: Add updated_at column for tracking last update
ALTER TABLE quiz_runs 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 4: Create index for active sessions (where ended_at IS NULL)
-- This index helps quickly find active sessions for a user/quiz combination
CREATE INDEX IF NOT EXISTS quiz_runs_active_session_idx 
  ON quiz_runs(user_id, quiz_id, ended_at) 
  WHERE ended_at IS NULL;

-- Step 5: Update completion_percentage to handle nullable ended_at
-- The generated column should still work, but we need to ensure it handles
-- the case where ended_at might be NULL (though it shouldn't affect the calculation)

-- Step 6: Add trigger to automatically update updated_at on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_quiz_runs_updated_at ON quiz_runs;
CREATE TRIGGER update_quiz_runs_updated_at
  BEFORE UPDATE ON quiz_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Update comments for documentation
COMMENT ON COLUMN quiz_runs.ended_at IS 'NULL for live sessions, set when session is completed';
COMMENT ON COLUMN quiz_runs.duration_seconds IS 'NULL for live sessions, calculated when session ends';
COMMENT ON COLUMN quiz_runs.updated_at IS 'Timestamp of last update to the session state';
COMMENT ON COLUMN quiz_runs.final_state IS 'Current state snapshot (updated during live session, final state when completed)';


