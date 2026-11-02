-- A rate change can also change the term (Terms §3.1: 6 or 12 months, or
-- month-to-month). Null leaves the term as it was. A term set here starts a
-- new term on the change's effective date, so renewals count from that date
-- rather than the original signing date.

ALTER TABLE client_rate_changes
  ADD COLUMN term_months INTEGER CHECK (term_months IN (0, 6, 12));
