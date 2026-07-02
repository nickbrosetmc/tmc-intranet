-- One person, multiple client accounts. client_users gains an email (for
-- welcome/login emails) and a junction table maps users to every client
-- they can access. client_users.client_id stays as the "primary" client
-- (the default active account at login); the junction is the authority on
-- membership. Existing users are backfilled with their current client.

ALTER TABLE client_users ADD COLUMN email TEXT;

CREATE TABLE client_user_clients (
    client_user_id INTEGER NOT NULL REFERENCES client_users(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (client_user_id, client_id)
);

CREATE INDEX idx_cuc_client ON client_user_clients(client_id);

INSERT INTO client_user_clients (client_user_id, client_id)
SELECT id, client_id FROM client_users;
