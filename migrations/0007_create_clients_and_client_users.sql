-- Client portal foundation: companies (clients) and the people who can
-- sign in for each company (client_users). Clients log in with username +
-- password rather than Google OAuth — most don't have @marketingtmc.com
-- emails and many don't use Google at all.

CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    files_url TEXT,            -- Per-client UGREEN/NAS share link
    ghl_url TEXT,              -- GHL dashboard URL (usually app.tmctechhub.com)
    password_vault_url TEXT,   -- Optional 1Password vault URL
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_active ON clients(is_active);

CREATE TABLE client_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_signed_in TEXT
);

CREATE INDEX idx_client_users_username ON client_users(username);
CREATE INDEX idx_client_users_client ON client_users(client_id);
