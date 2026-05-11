-- Status lifecycle collapses from 6 → 4. Approval / scheduling / posting
-- live in GHL — the portal only tracks whether the work is getting done
-- on time. New flow: idea → drafting → review → completed.
--
-- "Completed" means the post is approved (Nick has signed off). The team
-- is instructed not to mark it completed until Nick has approved.

-- Step 1: migrate existing rows. approved / scheduled / posted all become
-- "completed" since they were all post-approval states.
UPDATE content_posts SET status = 'completed'
WHERE status IN ('approved', 'scheduled', 'posted');

-- Step 2: SQLite can't ALTER a CHECK constraint, so recreate the table.
CREATE TABLE content_posts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES recurring_clients(id),
    title TEXT NOT NULL,
    pillar_id INTEGER REFERENCES pillars(id),
    funnel_stage_id INTEGER REFERENCES funnel_stages(id),
    scheduled_date TEXT NOT NULL,
    platform TEXT,
    status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN (
        'idea', 'drafting', 'review', 'completed'
    )),
    assigned_to INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO content_posts_new (
    id, client_id, title, pillar_id, funnel_stage_id, scheduled_date,
    platform, status, assigned_to, notes, created_at, updated_at
)
SELECT
    id, client_id, title, pillar_id, funnel_stage_id, scheduled_date,
    platform, status, assigned_to, notes, created_at, updated_at
FROM content_posts;

DROP TABLE content_posts;
ALTER TABLE content_posts_new RENAME TO content_posts;

CREATE INDEX idx_content_posts_scheduled ON content_posts(scheduled_date);
CREATE INDEX idx_content_posts_client_scheduled ON content_posts(client_id, scheduled_date);
CREATE INDEX idx_content_posts_status ON content_posts(status);
