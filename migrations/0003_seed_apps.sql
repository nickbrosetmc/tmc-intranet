-- Seed groups
INSERT INTO app_groups (id, name, sort_order) VALUES
    (1, 'Communication', 1),
    (2, 'Productivity', 2),
    (3, 'Operations', 3);

-- Seed apps
-- Communication
INSERT INTO apps (id, name, description, icon_url, icon_emoji, icon_bg_color, desktop_protocol, web_url, group_id, sort_order, is_active) VALUES
    (1, 'Microsoft Teams', 'Team chat, meetings, calls', 'https://cdn.simpleicons.org/microsoftteams/ffffff', '💬', '4B53BC', 'msteams://', 'https://teams.microsoft.com', 1, 1, 1),
    (2, 'Gmail', 'Email', 'https://cdn.simpleicons.org/gmail/ffffff', '✉️', 'EA4335', NULL, 'https://mail.google.com', 1, 2, 1),
    (3, 'Google Calendar', 'Schedule & events', 'https://cdn.simpleicons.org/googlecalendar/ffffff', '📅', '4285F4', NULL, 'https://calendar.google.com', 1, 3, 1);

-- Productivity
INSERT INTO apps (id, name, description, icon_url, icon_emoji, icon_bg_color, desktop_protocol, web_url, group_id, sort_order, is_active) VALUES
    (4, 'Google Drive', 'Files & folders', 'https://cdn.simpleicons.org/googledrive/ffffff', '📁', '0F9D58', NULL, 'https://drive.google.com', 2, 1, 1),
    (5, 'ChatGPT', 'AI assistant', 'https://cdn.simpleicons.org/openai/ffffff', '🤖', '10A37F', NULL, 'https://chat.openai.com', 2, 2, 1),
    (6, 'Canva', 'Design & creative', 'https://cdn.simpleicons.org/canva/ffffff', '🎨', '00C4CC', NULL, 'https://www.canva.com', 2, 3, 1);

-- Operations
INSERT INTO apps (id, name, description, icon_url, icon_emoji, icon_bg_color, desktop_protocol, web_url, group_id, sort_order, is_active, is_coming_soon) VALUES
    (7, 'GoHighLevel', 'CRM & client portal', NULL, '⚡', 'FF7F32', NULL, 'https://app.tmctechhub.com', 3, 1, 1, 0),
    (8, 'NAS', 'Shared file storage', NULL, '🗄️', '404E5C', NULL, 'http://nas.local', 3, 2, 1, 0),
    (9, 'ConnectTeam', 'Time tracking & scheduling', NULL, '👷', '2563EB', NULL, 'https://app.connectteam.com', 3, 3, 1, 1);
