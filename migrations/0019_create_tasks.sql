-- Team task tracker. Anyone on the team can create tasks for themselves
-- or assign them to a teammate. Tasks may optionally link to a content
-- post so the social planner shows the work attached to each post.
--
-- The "start task" timer is opt-in: clicking Start sets started_at and
-- moves the task into 'in_progress'. Completing it stamps completed_at
-- and writes the elapsed minutes to actual_minutes (editable on the
-- complete dialog so a run-over-lunch doesn't poison the number).
-- Tasks that never get the Start button still complete cleanly — actual
-- minutes just stays null.

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assignee_id INTEGER NOT NULL REFERENCES users(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TEXT,                  -- YYYY-MM-DD, nullable ("do whenever")
    estimated_minutes INTEGER,      -- nullable (no estimate is fine)
    actual_minutes INTEGER,         -- nullable; set on complete from timer
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    started_at TEXT,                -- set on Start; cleared on Start-again
    completed_at TEXT,
    -- Soft link to a content post — SET NULL so deleting a post doesn't
    -- nuke the task, just unhooks it.
    content_post_id INTEGER REFERENCES content_posts(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_assignee_status ON tasks(assignee_id, status);
-- Open-task lookups by due date are the hot path for "My Week".
CREATE INDEX idx_tasks_due_open
    ON tasks(due_date)
    WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_tasks_content_post ON tasks(content_post_id);
