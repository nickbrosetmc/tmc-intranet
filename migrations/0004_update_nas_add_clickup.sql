-- Update NAS to point at the UGREEN cloud link (the previous nas.local
-- only worked on the office LAN).
UPDATE apps
SET web_url = 'https://ug.link/tmcmarketing',
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'NAS';

-- Add ClickUp under Productivity. Put it at sort_order 4 so it follows
-- Drive/ChatGPT/Canva.
INSERT INTO apps (
    name, description, icon_url, icon_emoji, icon_bg_color,
    desktop_protocol, web_url, group_id, sort_order, is_active
) VALUES (
    'ClickUp', 'Tasks & projects',
    'https://cdn.simpleicons.org/clickup/ffffff', '✅', '7B68EE',
    NULL, 'https://app.clickup.com', 2, 4, 1
);
