ALTER TABLE verdict ADD COLUMN memory_vote_id TEXT REFERENCES memory (id) ON DELETE SET NULL;
CREATE INDEX ix_verdict_memory_vote ON verdict (memory_vote_id);

-- Old aggregates do not identify distinct visits. Keep historical labels, but require fresh support.
UPDATE memory SET tap_count = 0;
