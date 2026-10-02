-- When a one-off invoice was issued, separate from when the money lands.
--
-- Until now the payout date was the only date on a one-off invoice, so there
-- was no record of when the client was actually billed. Nullable because
-- ALTER TABLE can't add a NOT NULL column without a constant default; the
-- API requires it on every new invoice.

ALTER TABLE one_off_invoices ADD COLUMN invoice_date TEXT;
