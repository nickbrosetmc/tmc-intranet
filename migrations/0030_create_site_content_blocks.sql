-- Standalone "individual content blocks" for a website project — reusable
-- snippets that aren't a full page and aren't the universal header/footer
-- (a popup, a promo bar, an announcement strip, etc.). They're logged here so
-- the team (and the client) can update them later, and each regenerates as its
-- own copyable block. Client-editable, same as pages.

CREATE TABLE site_content_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES site_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                -- e.g. "Holiday hours popup"
    html TEXT NOT NULL DEFAULT '',     -- the complete block, with data-edit markers
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_site_content_blocks_project ON site_content_blocks(project_id, sort_order);
