-- Content pipeline: weekly content production tracking with pillar +
-- funnel stage coverage. Replaces what ClickUp / GHL Scheduling were
-- missing (pillar/funnel balance + approval progress visibility).
--
-- Each tracked client gets a weekly_post_target (2–4 typical). Posts
-- need to be approved by EOD Friday the week before they go live; the
-- dashboard surfaces progress toward that deadline with an 80–90%
-- by-Thursday checkpoint.

CREATE TABLE pillars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT NOT NULL DEFAULT '404E5C',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Placeholder pillars — admin renames in Settings to match TMC's actual
-- four pillars.
INSERT INTO pillars (name, description, color, sort_order) VALUES
    ('Authority', 'Expertise, thought leadership, credibility', 'CFB583', 1),
    ('Connection', 'Community, relationships, brand voice', '00C4CC', 2),
    ('Conversion', 'CTAs, offers, lead generation', 'A03030', 3),
    ('Culture', 'Behind the scenes, team, values', '4B53BC', 4);

CREATE TABLE funnel_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT NOT NULL DEFAULT '404E5C',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO funnel_stages (name, description, color, sort_order) VALUES
    ('Awareness',     'Top of funnel — cold audience',          '00C4CC', 1),
    ('Consideration', 'Audience knows you, evaluating',         'CFB583', 2),
    ('Decision',      'Bottom of funnel — ready to buy',        'A03030', 3),
    ('Retention',     'Existing customers — loyalty, advocacy', '404E5C', 4);

-- Opt a recurring client into content tracking by setting a target.
-- Null = not tracked (e.g. clients who only buy GHL but no content).
ALTER TABLE recurring_clients ADD COLUMN weekly_post_target INTEGER;

CREATE TABLE content_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES recurring_clients(id),
    title TEXT NOT NULL,
    pillar_id INTEGER REFERENCES pillars(id),
    funnel_stage_id INTEGER REFERENCES funnel_stages(id),
    scheduled_date TEXT NOT NULL,
    platform TEXT,
    status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN (
        'idea', 'drafting', 'review', 'approved', 'scheduled', 'posted'
    )),
    assigned_to INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_content_posts_scheduled ON content_posts(scheduled_date);
CREATE INDEX idx_content_posts_client_scheduled ON content_posts(client_id, scheduled_date);
CREATE INDEX idx_content_posts_status ON content_posts(status);
