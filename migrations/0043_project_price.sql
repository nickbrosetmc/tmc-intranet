-- A price on a client project, and invoices that pay for one.
--
-- Lifetime value counts a project's price once. One-off invoices for that
-- work (a deposit and a final payment, say) are linked to the project so
-- they aren't counted again on top; invoices not linked to a project still
-- count on their own. A project without a price is worth what its linked
-- invoices add up to.

ALTER TABLE client_projects ADD COLUMN price INTEGER;
ALTER TABLE one_off_invoices
  ADD COLUMN project_id INTEGER REFERENCES client_projects(id) ON DELETE SET NULL;
