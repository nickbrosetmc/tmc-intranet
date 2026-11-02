-- How many renewals projected lifetime value assumes for current clients,
-- set once for the whole team on Finance > Client lifetime. 1 means the rest
-- of each client's current term plus one more of the same length.

ALTER TABLE finance_settings
  ADD COLUMN projected_renewals INTEGER NOT NULL DEFAULT 1
  CHECK (projected_renewals BETWEEN 0 AND 5);
