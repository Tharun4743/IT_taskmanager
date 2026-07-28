-- SQL Query to clear task submissions and the task record in Supabase

-- Option A: Delete ONLY the submissions for this task (resets all student submissions for this task)
DELETE FROM task_submissions 
WHERE task_id = '9846e690-3530-4922-b231-cda2270f7be5';

-- Option B: Delete the task AND all its submissions completely
DELETE FROM task_submissions 
WHERE task_id = '9846e690-3530-4922-b231-cda2270f7be5';

DELETE FROM tasks 
WHERE id = '9846e690-3530-4922-b231-cda2270f7be5';
