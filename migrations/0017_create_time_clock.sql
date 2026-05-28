-- Job-based time clock. Each shift is tied to a specific job, and users
-- can only clock in for jobs they're eligible for. Backdated shifts are
-- submitted as 'pending' and require admin approval.
--
-- Pay rates are interpreted by pay_rate_type:
--   hourly    → $ per hour worked
--   day_rate  → $ per distinct calendar day worked
--   salaried  → informational only; not used for shift cost calculation

CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    pay_rate_type TEXT NOT NULL CHECK (pay_rate_type IN ('hourly', 'salaried', 'day_rate')),
    pay_rate REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_active ON jobs(is_active, sort_order);

CREATE TABLE job_eligibility (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, user_id)
);

CREATE INDEX idx_job_eligibility_user ON job_eligibility(user_id);
CREATE INDEX idx_job_eligibility_job ON job_eligibility(job_id);

CREATE TABLE time_clock_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    notes TEXT,
    -- Lifecycle:
    --   active     — user clocked in, shift in progress (ended_at IS NULL)
    --   completed  — finished; counted in hours/cost calcs
    --   pending    — backdated submission awaiting admin approval
    --   denied     — admin rejected the backdated submission
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'pending', 'denied')),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    denial_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shifts_user_started ON time_clock_shifts(user_id, started_at);
CREATE INDEX idx_shifts_status ON time_clock_shifts(status);
CREATE INDEX idx_shifts_active_user ON time_clock_shifts(user_id, status) WHERE status = 'active';
