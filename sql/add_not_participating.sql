-- ============================================================
-- Migration: Add "Not Participating" opt-out to task_submissions
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Add the boolean flag (default FALSE so existing rows are unaffected)
ALTER TABLE task_submissions
  ADD COLUMN IF NOT EXISTS not_participating BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add the reason text (nullable — only filled when not_participating = TRUE)
ALTER TABLE task_submissions
  ADD COLUMN IF NOT EXISTS not_participating_reason TEXT;

-- 3. Allow the new status value in the existing status check constraint
--    (Skip if your table uses a free-text column with no CHECK constraint)
--    If you have a constraint like:  CHECK (status IN ('SUBMITTED','VERIFIED','REJECTED'))
--    replace it to include 'NOT_PARTICIPATING':

-- Step 3a — find the exact constraint name:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'task_submissions'::regclass AND contype = 'c';

-- Step 3b — drop old constraint (replace <constraint_name> with actual name from above):
-- ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS <constraint_name>;

-- Step 3c — add updated constraint:
-- ALTER TABLE task_submissions
--   ADD CONSTRAINT task_submissions_status_check
--   CHECK (status IN ('SUBMITTED', 'VERIFIED', 'REJECTED', 'NOT_PARTICIPATING'));

-- 4. (Optional) Index for fast filtering in admin/advisor views
CREATE INDEX IF NOT EXISTS idx_task_submissions_not_participating
  ON task_submissions (not_participating)
  WHERE not_participating = TRUE;

-- 5. Quick verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'task_submissions'
  AND column_name IN ('not_participating', 'not_participating_reason');
