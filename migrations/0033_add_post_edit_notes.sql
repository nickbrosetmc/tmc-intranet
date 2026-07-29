-- Review kickback: a reviewer can send a post back to a specific person
-- with edit notes instead of only approving it.
--
-- edit_notes is kept separate from the general `notes` field so a kickback
-- never clobbers the post's standing notes. Notes persist after the edits
-- are resubmitted so the reviewer can verify the changes were made; they
-- are cleared when the post is completed or when someone clears them.

ALTER TABLE content_posts ADD COLUMN edit_notes TEXT;
ALTER TABLE content_posts ADD COLUMN edit_requested_by INTEGER REFERENCES users(id);
ALTER TABLE content_posts ADD COLUMN edit_requested_at TEXT;
