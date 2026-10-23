-- What a client pays, over time.
--
-- recurring_clients.monthly_amount is the current rate, which MRR and cash
-- flow use. Lifetime value needs every month at the rate actually billed
-- then: a client who paid $1,500 for a year and then dropped to $150 for
-- hosting was worth far more than 13 x $150. Each row records one change:
-- from what, to what, effective when, and why. Before the first change a
-- client paid that change's from_amount; after a change, its to_amount.

CREATE TABLE client_rate_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES recurring_clients(id),
  effective_date TEXT NOT NULL,
  from_amount INTEGER NOT NULL,
  to_amount INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX client_rate_changes_client ON client_rate_changes (client_id, effective_date);
