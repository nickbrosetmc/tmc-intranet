-- Each client posts on the same set of weekdays every week. Storing it
-- as a comma-separated list of 3-letter lowercase day codes
-- (e.g. "tue,fri") keeps the DB readable and the parsing trivial.
--
-- When set, the content tracker auto-seeds blank "Untitled" posts on
-- those days for the current week so Kit's task list always has the
-- week's slots ready to fill in. NULL → no auto-seed; the existing
-- shortfall placeholders still apply for clients with a weekly target.

ALTER TABLE recurring_clients ADD COLUMN posting_days TEXT;
