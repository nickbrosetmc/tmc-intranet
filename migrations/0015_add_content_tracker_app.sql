-- Add the Content Tracker as an app in the launcher (Internal Tools group).
-- It links to the SPA route /content. The page handles team vs admin visibility
-- of the Settings tab via the user's role.

INSERT INTO apps (
    name, description, icon_url, icon_emoji, icon_bg_color,
    desktop_protocol, web_url, group_id, sort_order, is_active, is_coming_soon
) VALUES (
    'Content Tracker',
    'Weekly content schedule + pillar/funnel coverage',
    NULL,
    '📝',
    '00C4CC',
    NULL,
    '/content',
    (SELECT id FROM app_groups WHERE name = 'Internal Tools'),
    3,
    1,
    0
);
