-- Client-submitted requests and event briefs. One table, discriminated by
-- `type`, so the admin inbox can list both together. Events use the extra
-- event_date / location columns; requests leave them null.
--
-- On submit the portal emails the team (recipients configurable via the
-- content_settings 'client_notify_emails' key, seeded below).

CREATE TABLE client_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    client_user_id INTEGER NOT NULL REFERENCES client_users(id),
    type TEXT NOT NULL CHECK (type IN ('request', 'event')),
    subject TEXT NOT NULL,            -- request title, or event name
    details TEXT NOT NULL,            -- description / marketing goals
    event_date TEXT,                  -- YYYY-MM-DD, events only
    location TEXT,                    -- events only
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'in_progress', 'done')),
    admin_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_submissions_client ON client_submissions(client_id, created_at);
CREATE INDEX idx_client_submissions_status ON client_submissions(status);

-- Who gets notified when a client submits. Comma-separated; editable in
-- the admin inbox.
INSERT INTO content_settings (key, value)
VALUES ('client_notify_emails', 'nick.brose@marketingtmc.com,kit.gagnon@marketingtmc.com')
ON CONFLICT(key) DO NOTHING;
