-- Posts now carry an explicit reviewer alongside the assignee. When a
-- post moves to status='review' the reviewer takes ownership: the task
-- shifts off the assignee's list and onto the reviewer's. Status flips
-- back to drafting or completed shift ownership back to the assignee.

ALTER TABLE content_posts ADD COLUMN reviewer_id INTEGER REFERENCES users(id);
