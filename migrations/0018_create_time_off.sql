-- Time-off requests. Policy is unlimited vacation as long as work is
-- completed or coverage is arranged, so every request must include a
-- coverage plan. New requests land as 'pending' and an admin
-- approves or denies with an optional note.
--
-- Date range is inclusive on both ends and stored as YYYY-MM-DD —
-- we don't care about partial days for now (whole-day granularity is
-- enough for an unlimited-PTO policy where coverage is the real check).

CREATE TABLE time_off_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    start_date TEXT NOT NULL,           -- YYYY-MM-DD (inclusive)
    end_date TEXT NOT NULL,             -- YYYY-MM-DD (inclusive)
    reason TEXT,                        -- optional, free-text
    coverage_plan TEXT NOT NULL,        -- required, who's covering / how
    -- Lifecycle:
    --   pending   — submitted, awaiting admin decision
    --   approved  — green-lit, shows on team calendar
    --   denied    — rejected; admin_note explains why
    --   cancelled — user withdrew before a decision was made
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
    decided_by INTEGER REFERENCES users(id),
    decided_at TEXT,
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_time_off_user ON time_off_requests(user_id, start_date);
CREATE INDEX idx_time_off_status ON time_off_requests(status);
-- Calendar view only ever queries approved ranges, and most of the table
-- will be historical — a partial index keeps the hot path cheap.
CREATE INDEX idx_time_off_approved_range
    ON time_off_requests(start_date, end_date)
    WHERE status = 'approved';
