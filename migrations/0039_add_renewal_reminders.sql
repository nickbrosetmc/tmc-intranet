-- Renewal reminder emails, 45 and 30 days before each client's renewal.
--
-- One row per reminder sent, so the daily job never sends the same one twice
-- and a failed send (no row written) is retried the next day. Keyed by the
-- renewal date as well as the client: the next term's renewal gets its own
-- reminders, and so does a renewal that moves because the signed date or
-- term was corrected.

CREATE TABLE renewal_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES recurring_clients(id),
  renewal_date TEXT NOT NULL,
  days_before INTEGER NOT NULL CHECK (days_before IN (45, 30)),
  sent_to TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (client_id, renewal_date, days_before)
);

-- Who gets them. Editable under Finance > Client lifetime.
INSERT OR IGNORE INTO content_settings (key, value)
VALUES ('renewal_notify_emails', 'nick.brose@marketingtmc.com');
