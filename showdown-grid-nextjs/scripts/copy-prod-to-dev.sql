-- Script to copy data from prod to dev
-- Run this in PROD database first to export, then in DEV to import

-- Step 1: Get all quizzes data
-- Run this in prod SQL editor, copy the results
SELECT
  id,
  user_id,
  title,
  description,
  quiz_data,
  is_public,
  theme,
  time_limit,
  created_at,
  updated_at
FROM quizzes
ORDER BY created_at;

-- Step 2: Get all users data
SELECT
  user_id,
  active_quiz_id,
  created_at,
  updated_at
FROM users
ORDER BY created_at;

-- Step 3: Get all quiz_runs data (if exists)
SELECT
  id,
  quiz_id,
  user_id,
  started_at,
  ended_at,
  duration_seconds,
  quiz_title,
  quiz_description,
  quiz_theme,
  quiz_time_limit,
  final_state,
  total_questions,
  answered_questions,
  team_results,
  winning_team_name,
  winning_score,
  created_at
FROM quiz_runs
ORDER BY created_at;
