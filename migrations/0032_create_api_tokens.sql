-- Personal API tokens so external agents (e.g. Nick's Claude chief of
-- staff) can call the portal API with Authorization: Bearer tmc_<token>.
-- Only the SHA-256 hash is stored; the raw token is shown once at mint.
-- scope 'read' allows GET only; 'write' allows mutations too. Tokens act
-- as the owning user (role included), and are revocable.

CREATE TABLE api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    label TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scope TEXT NOT NULL DEFAULT 'read' CHECK (scope IN ('read', 'write')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    revoked_at TEXT
);

CREATE INDEX idx_api_tokens_user ON api_tokens(user_id);
