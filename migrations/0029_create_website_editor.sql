-- Website editor: lets non-technical clients safely edit their own
-- GHL-hosted sites. The agency (team) sets up a project per client by
-- pasting in the universal header/footer and each page's body HTML, marking
-- the spots that should be editable. The client then edits only those zones,
-- reorders/adds/removes list items, and submits the batch. The team reviews
-- the submission and copies the regenerated, full-length blocks into GHL.
--
-- Mirrors GHL's structure exactly: header + footer are ONE universal block
-- each (shared by every page); each page is its own body block. A submission
-- stores a snapshot of what changed plus the regenerated blocks, so the
-- review screen is reproducible even after the live project moves on.

-- One website per row, owned by a client. (Schema allows >1 per client for
-- future multi-site clients; today it's 1:1.)
CREATE TABLE site_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    domain TEXT,                       -- display only, e.g. "holdmybeer.com"
    header_html TEXT NOT NULL DEFAULT '',  -- GHL universal header block
    footer_html TEXT NOT NULL DEFAULT '',  -- GHL universal footer block
    theme_json TEXT,                   -- optional brand tokens (colors/fonts)
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_site_projects_client ON site_projects(client_id);

-- Each page is its own GHL body block. body_html is the COMPLETE source for
-- that block; edits mutate it in place and the whole thing is what gets
-- copied back into GHL.
CREATE TABLE site_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES site_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,                -- "/", "/services", …
    body_html TEXT NOT NULL DEFAULT '',
    nav_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, slug)
);

CREATE INDEX idx_site_pages_project ON site_pages(project_id, nav_order);

-- A batch of edits the client sent for review. We snapshot the human-readable
-- change list (changes_json) AND the regenerated, full-length blocks ready to
-- paste into GHL (blocks_json) so the review screen never has to recompute
-- from a project that may have changed since. done_json tracks which blocks
-- the team has already pasted (the "mark done" checkboxes).
CREATE TABLE site_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES site_projects(id) ON DELETE CASCADE,
    client_user_id INTEGER REFERENCES client_users(id) ON DELETE SET NULL,
    submitted_by_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'published', 'dismissed')),
    changes_json TEXT NOT NULL DEFAULT '[]',  -- [{label, group}]
    blocks_json TEXT NOT NULL DEFAULT '[]',   -- [{title, note, code}]
    done_json TEXT NOT NULL DEFAULT '[]',     -- [blockTitle, …] pasted so far
    published_by INTEGER REFERENCES users(id),
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard hot path: pending submissions, newest first.
CREATE INDEX idx_site_submissions_open
    ON site_submissions(project_id, created_at)
    WHERE status = 'pending';

-- The "request a change" escape hatch — free text + an optional uploaded file
-- for anything outside the client's editable zones.
CREATE TABLE site_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES site_projects(id) ON DELETE CASCADE,
    client_user_id INTEGER REFERENCES client_users(id) ON DELETE SET NULL,
    submitted_by_name TEXT NOT NULL,
    body TEXT NOT NULL,
    asset_key TEXT,                    -- R2 object key, if a file was attached
    asset_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'handled')),
    handled_by INTEGER REFERENCES users(id),
    handled_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_site_requests_open
    ON site_requests(project_id, created_at)
    WHERE status = 'pending';

-- Images uploaded from the editor (hero swaps, etc.), stored in R2. The key
-- is the R2 object key; we serve them back through a Function.
CREATE TABLE site_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES site_projects(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    uploaded_by_client_user_id INTEGER REFERENCES client_users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_site_assets_project ON site_assets(project_id);
