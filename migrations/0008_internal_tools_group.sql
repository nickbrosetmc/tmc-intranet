-- Move the calculators out of the header navigation and into the app
-- launcher grid as their own group, "Internal Tools". Apps with web_url
-- starting with "/" navigate within the SPA (handled in AppTile).

INSERT INTO app_groups (name, sort_order) VALUES
    ('Internal Tools', 4);

-- Reference the just-inserted Internal Tools group via its name (id is
-- auto-incremented). Using a subquery keeps the migration portable.
INSERT INTO apps (
    name, description, icon_url, icon_emoji, icon_bg_color,
    desktop_protocol, web_url, group_id, sort_order, is_active, is_coming_soon
) VALUES
    (
      'Package Calculator',
      'Service package pricing + margin checks',
      NULL,
      '📊',
      '404E5C',
      NULL,
      '/calculator',
      (SELECT id FROM app_groups WHERE name = 'Internal Tools'),
      1,
      1,
      0
    ),
    (
      'Video Calculator',
      'Per-project video quote builder',
      NULL,
      '🎬',
      'A03030',
      NULL,
      '/video-calculator',
      (SELECT id FROM app_groups WHERE name = 'Internal Tools'),
      2,
      1,
      0
    );
