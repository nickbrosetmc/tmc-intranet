-- One-off paid invoices (project work, ad-hoc charges, anything not on
-- a monthly retainer). Net amount received is computed on-the-fly from
-- gross + payment_method fees + instant_payout flag — we don't store it
-- so rate changes flow through automatically.
--
-- payout_date is when funds land in TMC's bank account. For instant
-- payouts that's the same day the invoice was paid; for standard payouts
-- it's typically 2–5 days later.

CREATE TABLE one_off_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    gross_amount INTEGER NOT NULL,           -- in DOLLARS
    payment_method_id INTEGER REFERENCES payment_methods(id),
    payout_date TEXT NOT NULL,               -- ISO YYYY-MM-DD
    instant_payout INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_one_off_invoices_payout_date ON one_off_invoices(payout_date);
