-- Support tickets: a third submission type for technical problems, alongside
-- requests and event briefs.
--
-- `type` carries a CHECK constraint and SQLite cannot alter one in place, so
-- the table is rebuilt. Adds `severity`, which only support tickets set.
--
-- Requests were previously described to clients as the place to "flag an
-- issue"; existing rows stay as requests rather than being guessed at.

CREATE TABLE client_submissions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    client_user_id INTEGER NOT NULL REFERENCES client_users(id),
    type TEXT NOT NULL CHECK (type IN ('request', 'event', 'support')),
    subject TEXT NOT NULL,            -- request title, event name, or issue summary
    details TEXT NOT NULL,            -- description / marketing goals / what's broken
    event_date TEXT,                  -- YYYY-MM-DD, events only
    location TEXT,                    -- events only; support reuses none of this
    severity TEXT CHECK (severity IN ('low', 'normal', 'high', 'urgent')),
    affected_url TEXT,                -- support only: the page or system affected
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'in_progress', 'done')),
    admin_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO client_submissions_new (
    id, client_id, client_user_id, type, subject, details,
    event_date, location, severity, affected_url, status, admin_notes,
    created_at, updated_at
)
SELECT
    id, client_id, client_user_id, type, subject, details,
    event_date, location, NULL, NULL, status, admin_notes,
    created_at, updated_at
FROM client_submissions;

DROP TABLE client_submissions;
ALTER TABLE client_submissions_new RENAME TO client_submissions;

CREATE INDEX idx_client_submissions_client ON client_submissions(client_id, created_at);
CREATE INDEX idx_client_submissions_status ON client_submissions(status);
CREATE INDEX idx_client_submissions_type ON client_submissions(type, status);
