-- Atomic claim table for the weekly blank-post seeder. One row per
-- (client, production-week Monday). The composite primary key is the
-- lock: the first dashboard load to INSERT a (client_id, week_start) row
-- wins and seeds that client's posts; concurrent loads hit the PK
-- conflict, INSERT OR IGNORE no-ops, and they skip seeding. This closes
-- the check-then-act race that could otherwise spawn duplicate "Untitled"
-- posts on a brand-new week — without a UNIQUE(client_id, scheduled_date)
-- on content_posts, which would wrongly block a client legitimately
-- posting twice on the same day.

CREATE TABLE content_seed_log (
    client_id INTEGER NOT NULL REFERENCES recurring_clients(id),
    week_start TEXT NOT NULL,  -- YYYY-MM-DD, Monday of the seeded week
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (client_id, week_start)
);
