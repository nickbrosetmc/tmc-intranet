-- Generic content-tracker settings, keyed by string. First user is
-- 'default_post_assignee_id' — the team member that newly-created
-- content posts default to (Kit, our marketing coordinator, in the
-- normal case). Anyone can be re-assigned via the post dialog.
--
-- Using a key/value table instead of widening an existing settings row
-- so future single-row settings (default platform, default status, etc.)
-- can land without a migration each time.

CREATE TABLE content_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
