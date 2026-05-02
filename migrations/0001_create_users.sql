-- Users table doubles as the invite list.
-- Admin pre-inserts a row with email + role; on first sign-in the rest of the
-- profile (name, picture, last_signed_in) gets filled in from the Google
-- userinfo response.

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    picture TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    invited_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_signed_in TEXT
);

CREATE INDEX idx_users_email ON users(email);
