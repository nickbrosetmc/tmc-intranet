-- Two "Kit Gagnon" rows existed: id 5 (intern@) and id 9 (kit.gagnon@).
-- Posts auto-assigned to id 5 weren't visible on the kit.gagnon@ user's
-- By Person view. Consolidate everything onto id 9 (the real email) and
-- deactivate id 5 so the picker no longer shows two Kits.

-- 1. Re-point every FK on user(id)=5 → 9. UPDATE OR IGNORE handles the
--    UNIQUE(job_id, user_id) collision on job_eligibility; the leftover
--    user_id=5 rows get cleaned up after.
UPDATE content_posts        SET assigned_to = 9 WHERE assigned_to = 5;
UPDATE content_posts        SET reviewer_id = 9 WHERE reviewer_id = 5;
UPDATE tasks                SET assignee_id = 9 WHERE assignee_id = 5;
UPDATE tasks                SET created_by  = 9 WHERE created_by  = 5;
UPDATE announcements        SET created_by  = 9 WHERE created_by  = 5;
UPDATE app_launches         SET user_id     = 9 WHERE user_id     = 5;
UPDATE time_clock_shifts    SET user_id     = 9 WHERE user_id     = 5;
UPDATE time_clock_shifts    SET approved_by = 9 WHERE approved_by = 5;
UPDATE time_off_requests    SET user_id     = 9 WHERE user_id     = 5;
UPDATE time_off_requests    SET decided_by  = 9 WHERE decided_by  = 5;
UPDATE finance_settings     SET updated_by  = 9 WHERE updated_by  = 5;
UPDATE users                SET invited_by  = 9 WHERE invited_by  = 5;

UPDATE OR IGNORE job_eligibility SET user_id = 9 WHERE user_id = 5;
DELETE FROM job_eligibility WHERE user_id = 5;

-- 2. Re-point the default-assignee setting.
UPDATE content_settings
SET value = '9', updated_at = CURRENT_TIMESTAMP
WHERE key = 'default_post_assignee_id' AND value = '5';

-- 3. Deactivate user 5 without deleting (FKs without ON DELETE CASCADE
--    would otherwise block, and we want history intact). Re-mark the
--    name + email so the row can't be re-selected by mistake.
UPDATE users
SET
    name = 'Kit Gagnon (deactivated)',
    email = 'deactivated-id5@deactivated.local'
WHERE id = 5;
