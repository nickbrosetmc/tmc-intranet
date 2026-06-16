-- Posts created before we wired up the default-assignee setting (and any
-- one-offs the team left Unassigned) never landed on Kit's task list
-- because the filter only matched explicit assignees. Backfill the open
-- ones to the configured default so they show up correctly.
--
-- Only touches OPEN posts (status != 'completed'); completed history
-- stays as it is for audit/analytics purposes. The runtime safety net in
-- effectiveAssigneeId prevents this drift from re-occurring going
-- forward, but the backfill cleans up what already exists.

UPDATE content_posts
SET assigned_to = (
    SELECT CAST(value AS INTEGER)
    FROM content_settings
    WHERE key = 'default_post_assignee_id'
)
WHERE assigned_to IS NULL
  AND status != 'completed'
  AND EXISTS (
    SELECT 1
    FROM content_settings
    WHERE key = 'default_post_assignee_id'
      AND value IS NOT NULL
      AND value != ''
  );
