-- Singleton settings row for the package pricing calculator. id is always 1;
-- enforced via CHECK so admins can't accidentally insert a second row.

CREATE TABLE calculator_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    rate_admin INTEGER NOT NULL DEFAULT 60,
    rate_ft INTEGER NOT NULL DEFAULT 23,
    rate_pt INTEGER NOT NULL DEFAULT 20,
    review_tier TEXT NOT NULL DEFAULT 'admin' CHECK (review_tier IN ('admin', 'ft', 'pt', 'none')),
    review_mins INTEGER NOT NULL DEFAULT 5,
    software_total INTEGER NOT NULL DEFAULT 2000,
    client_count INTEGER NOT NULL DEFAULT 12,
    margin_floor INTEGER NOT NULL DEFAULT 30,
    billable_rate INTEGER NOT NULL DEFAULT 150,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the singleton row with defaults
INSERT INTO calculator_settings (id) VALUES (1);
