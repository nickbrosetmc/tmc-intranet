-- Team-adjustable video shoot day rates. Previously hardcoded in
-- video-calculator.ts (DEFAULT_VIDEO_RATES) and only changeable per-quote
-- via the advanced override card. Moving them into calculator_settings so
-- an admin can set the standard rates once for the whole team. Defaults
-- match the old constants (half 1800, full 2800, extra day 2500).

ALTER TABLE calculator_settings ADD COLUMN rate_day_half INTEGER NOT NULL DEFAULT 1800;
ALTER TABLE calculator_settings ADD COLUMN rate_day_full INTEGER NOT NULL DEFAULT 2800;
ALTER TABLE calculator_settings ADD COLUMN rate_day_extra INTEGER NOT NULL DEFAULT 2500;
