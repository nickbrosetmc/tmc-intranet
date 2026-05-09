-- Financial dashboard schema. Admin-only via /admin/finance.
-- Money columns are stored in DOLLARS (integer). Cents stored separately
-- where they matter (payment_methods.fee_flat). This keeps math exact and
-- the UI doesn't need decimal handling.

CREATE TABLE payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    fee_pct REAL NOT NULL DEFAULT 0,        -- e.g. 0.029 for 2.9%
    fee_flat INTEGER NOT NULL DEFAULT 0,     -- in CENTS, e.g. 30 = $0.30
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payment_methods (name, fee_pct, fee_flat, sort_order) VALUES
    ('ACH', 0, 0, 1),
    ('Check', 0, 0, 2),
    ('Wire', 0, 2500, 3),
    ('Credit Card', 0.029, 30, 4),
    ('Other', 0, 0, 5);

CREATE TABLE expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    monthly_budget INTEGER,                  -- in DOLLARS; null = no budget
    color TEXT NOT NULL DEFAULT '404E5C',    -- hex without #
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO expense_categories (name, color, sort_order) VALUES
    ('Software', '4B53BC', 1),
    ('Payroll', 'CFB583', 2),
    ('Equipment', 'A03030', 3),
    ('Rent / Office', '404E5C', 4),
    ('Marketing', '00C4CC', 5),
    ('Other', '6D6E76', 6);

CREATE TABLE recurring_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    monthly_amount INTEGER NOT NULL,         -- in DOLLARS
    payment_method_id INTEGER REFERENCES payment_methods(id),
    invoice_day INTEGER,                     -- 1-31
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurring_clients_active ON recurring_clients(is_active, sort_order);

CREATE TABLE recurring_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES expense_categories(id),
    monthly_amount INTEGER NOT NULL,         -- in DOLLARS
    payment_day INTEGER,                     -- 1-31
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurring_expenses_active ON recurring_expenses(is_active, sort_order);

CREATE TABLE one_time_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES expense_categories(id),
    amount INTEGER NOT NULL,                 -- in DOLLARS
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'paid')),
    planned_date TEXT,                       -- ISO YYYY-MM-DD
    paid_date TEXT,                          -- ISO YYYY-MM-DD
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_one_time_expenses_status ON one_time_expenses(status, planned_date, paid_date);

CREATE TABLE finance_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_balance INTEGER NOT NULL DEFAULT 0,
    balance_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    updated_by INTEGER REFERENCES users(id)
);

INSERT INTO finance_settings (id) VALUES (1);
