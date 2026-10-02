-- When a client submission last changed status, shown to the client.
--
-- updated_at also moves when the team edits internal notes, so a client
-- would see "updated today" on a request where nothing they can see had
-- changed. This moves only on a status change.

ALTER TABLE client_submissions ADD COLUMN status_changed_at TEXT;

-- Best available history for submissions already past "new".
UPDATE client_submissions SET status_changed_at = updated_at WHERE status <> 'new';
