-- App groups (categories like "Communication", "Productivity")
CREATE TABLE app_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_groups_sort ON app_groups(sort_order);

-- Individual apps (Teams, Canva, etc.)
CREATE TABLE apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,           -- e.g. https://cdn.simpleicons.org/microsoftteams/4B53BC
    icon_emoji TEXT,         -- fallback if icon_url fails or is null
    icon_bg_color TEXT,      -- hex without # for the tile background
    desktop_protocol TEXT,   -- e.g. "msteams://" — try first if present
    web_url TEXT,            -- e.g. https://teams.microsoft.com — fallback
    group_id INTEGER REFERENCES app_groups(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_coming_soon INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apps_group_sort ON apps(group_id, sort_order);
CREATE INDEX idx_apps_active ON apps(is_active);

-- Launch log for analytics
CREATE TABLE app_launches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    app_id INTEGER NOT NULL REFERENCES apps(id),
    launch_type TEXT NOT NULL CHECK (launch_type IN ('desktop', 'web')),
    launched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_launches_user_time ON app_launches(user_id, launched_at);
CREATE INDEX idx_app_launches_app_time ON app_launches(app_id, launched_at);
