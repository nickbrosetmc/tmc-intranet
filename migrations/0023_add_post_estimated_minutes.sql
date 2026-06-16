-- Posts get an estimated_minutes column so we can roll their time into
-- the /tasks summary alongside manual tasks. New posts default to the
-- 'default_post_estimated_minutes' content_settings value (45 unless
-- the admin changes it).

ALTER TABLE content_posts ADD COLUMN estimated_minutes INTEGER;

INSERT INTO content_settings (key, value)
VALUES ('default_post_estimated_minutes', '45')
ON CONFLICT(key) DO NOTHING;
