-- Client lifetime: when each retainer client signed, on what term, when they
-- left, and a correction to the estimated lifetime value.
--
-- Renewal dates aren't stored: under Terms §3.3 a 6- or 12-month term
-- renews automatically for the same length, so they follow from the signed
-- date and the term. All nullable: existing clients get these filled in by
-- hand, and the averages skip any client still missing them.

ALTER TABLE recurring_clients ADD COLUMN signed_date TEXT;
-- 6 or 12 months, 0 for month-to-month, null when not recorded.
ALTER TABLE recurring_clients ADD COLUMN term_months INTEGER;
-- Last day of service, for clients who have left.
ALTER TABLE recurring_clients ADD COLUMN ended_date TEXT;
-- Whole dollars added to (or, negative, taken off) the estimate.
ALTER TABLE recurring_clients ADD COLUMN ltv_adjustment INTEGER;
