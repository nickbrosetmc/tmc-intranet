-- Wave Pro charges instant payout as a SECOND fee taken off the remaining
-- amount after the initial processing fee — i.e. compounding, not added.
-- Add a dedicated column so the dashboard can compute net correctly:
--   remaining = gross - (gross * fee_pct) - (fee_flat / 100)
--   net       = remaining * (1 - instant_payout_pct)

ALTER TABLE payment_methods ADD COLUMN instant_payout_pct REAL NOT NULL DEFAULT 0;

-- TMC opts into instant payouts on all electronic methods. Checks aren't
-- eligible (paper checks don't go through Wave's payout system).
UPDATE payment_methods SET instant_payout_pct = 0.01
  WHERE name IN ('V/MC/Disc', 'Amex', 'Bank');
