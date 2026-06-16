-- Posts created before estimated_minutes existed all have NULL estimates,
-- so the /tasks summary rolls them in as 0 even though the default is 45.
-- Backfill open posts to the configured default. Completed history is
-- left alone so any post-mortem time analysis stays untouched.

UPDATE content_posts
SET estimated_minutes = (
    SELECT CAST(value AS INTEGER)
    FROM content_settings
    WHERE key = 'default_post_estimated_minutes'
)
WHERE estimated_minutes IS NULL
  AND status != 'completed'
  AND EXISTS (
    SELECT 1
    FROM content_settings
    WHERE key = 'default_post_estimated_minutes'
      AND value IS NOT NULL
      AND value != ''
  );
