-- Client profiles: one client list, linked to portal accounts, with projects.
--
-- recurring_clients is the master client list (retainer and project-only
-- clients alike). Portal accounts (clients) were a separate list with no
-- link between the two; portal_client_id ties a client to its portal
-- account, cleared automatically if that account is deleted.

ALTER TABLE recurring_clients
  ADD COLUMN portal_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;

-- Link the clients whose names match a portal account exactly (ignoring
-- case and spaces), where exactly one account has that name. The rest are
-- linked by hand on the client's profile.
UPDATE recurring_clients
SET portal_client_id = (
  SELECT c.id FROM clients c
  WHERE lower(trim(c.name)) = lower(trim(recurring_clients.name))
)
WHERE portal_client_id IS NULL
  AND (
    SELECT COUNT(*) FROM clients c
    WHERE lower(trim(c.name)) = lower(trim(recurring_clients.name))
  ) = 1;

-- Work we ship for a client. The launch date is when analytics should look
-- back to; a date still ahead is a planned launch, none means not scheduled.
CREATE TABLE client_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES recurring_clients(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'website'
    CHECK (kind IN ('website', 'landing_page', 'ecommerce', 'branding', 'campaign', 'other')),
  launch_date TEXT,
  url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX client_projects_client ON client_projects (client_id);
