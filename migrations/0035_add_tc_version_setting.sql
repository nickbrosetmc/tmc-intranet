-- The Terms and Conditions version the proposal generator cites.
--
-- Previously hardcoded in the frontend, which meant every revision of the
-- Terms needed a code change to stay accurate on signed documents. Held in
-- the shared calculator settings so the whole team generates proposals citing
-- the same version.

ALTER TABLE calculator_settings ADD COLUMN tc_version TEXT NOT NULL DEFAULT '2026.1';
ALTER TABLE calculator_settings ADD COLUMN tc_effective TEXT NOT NULL DEFAULT 'August 3, 2026';
