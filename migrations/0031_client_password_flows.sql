-- Client password hygiene:
--   must_change_password — set for new users and after an admin password
--     reset; the portal blocks until they set their own password.
--   reset_token_hash / reset_token_expires / reset_requested_at — the
--     forgot-password flow. Only the SHA-256 hash of the token is stored,
--     tokens are single-use with a 30-minute TTL, and reset_requested_at
--     throttles how often a new link can be requested.
--
-- Existing users are left at must_change_password=0 so nobody currently
-- using the portal gets interrupted.

ALTER TABLE client_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE client_users ADD COLUMN reset_token_hash TEXT;
ALTER TABLE client_users ADD COLUMN reset_token_expires TEXT;
ALTER TABLE client_users ADD COLUMN reset_requested_at TEXT;
