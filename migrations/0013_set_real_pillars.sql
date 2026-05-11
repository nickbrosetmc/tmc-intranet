-- Rename seeded placeholder pillars to TMC's actual four, and add
-- monthly target percentages so the Coverage view can flag when we're
-- over/under-indexing on a theme.
--
-- Targets: Helpful 30% · Heard 30% · Humor 20% · Happenings 20% = 100%.

ALTER TABLE pillars ADD COLUMN target_pct INTEGER;

UPDATE pillars
SET name = 'Helpful',
    description = 'Useful tips, how-tos, value-first content',
    color = 'CFB583',
    target_pct = 30,
    sort_order = 1
WHERE name = 'Authority';

UPDATE pillars
SET name = 'Heard',
    description = 'Customer voices, testimonials, community feedback',
    color = '00C4CC',
    target_pct = 30,
    sort_order = 2
WHERE name = 'Connection';

UPDATE pillars
SET name = 'Humor',
    description = 'Playful, entertaining, brand personality',
    color = 'F59E0B',
    target_pct = 20,
    sort_order = 3
WHERE name = 'Conversion';

UPDATE pillars
SET name = 'Happenings',
    description = 'News, events, behind-the-scenes',
    color = '4B53BC',
    target_pct = 20,
    sort_order = 4
WHERE name = 'Culture';
