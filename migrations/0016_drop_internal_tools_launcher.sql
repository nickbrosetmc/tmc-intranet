-- "Internal Tools" group (Package Calc, Video Calc, Content Tracker) moves
-- out of the app launcher and into the primary nav menu. The launcher is
-- now reserved for external tool deep-links only (Teams, Gmail, GHL, etc.)
-- so the line between "third-party app I'm jumping to" and "first-class
-- portal page" is clean.
--
-- app_launches rows reference these apps via FK, so we soft-delete (set
-- is_active=false) instead of dropping — preserves historical analytics.

UPDATE apps
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE name IN ('Package Calculator', 'Video Calculator', 'Content Tracker');

-- Clear the group_id on the now-inactive rows so the group itself can be
-- deleted cleanly.
UPDATE apps
SET group_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE name IN ('Package Calculator', 'Video Calculator', 'Content Tracker');

DELETE FROM app_groups WHERE name = 'Internal Tools';
