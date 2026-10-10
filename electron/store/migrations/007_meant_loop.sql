-- docs/data-model.md

ALTER TABLE session ADD COLUMN work_min INTEGER;
ALTER TABLE session ADD COLUMN break_min INTEGER;
ALTER TABLE session ADD COLUMN cycle_count INTEGER;
ALTER TABLE session ADD COLUMN phase TEXT CONSTRAINT ck_session_phase CHECK (phase IS NULL OR phase IN ('work', 'break'));
ALTER TABLE session ADD COLUMN phase_ends_at TEXT;

CREATE TABLE saved_target (
    target TEXT NOT NULL CONSTRAINT pk_saved_target PRIMARY KEY,
    role TEXT NOT NULL CONSTRAINT ck_saved_role CHECK (role IN ('work', 'block'))
);

CREATE TABLE block_hit (
    id TEXT NOT NULL CONSTRAINT pk_block_hit PRIMARY KEY,
    session_id TEXT NOT NULL CONSTRAINT fk_hit_session REFERENCES session (id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    kind TEXT NOT NULL CONSTRAINT ck_hit_kind CHECK (kind IN ('site', 'app')),
    reached_at TEXT NOT NULL
);
CREATE UNIQUE INDEX uq_block_hit_once ON block_hit (session_id, target);

CREATE TABLE coach_turn (
    id TEXT NOT NULL CONSTRAINT pk_coach_turn PRIMARY KEY,
    session_id TEXT NOT NULL CONSTRAINT fk_coach_session REFERENCES session (id) ON DELETE CASCADE,
    role TEXT NOT NULL CONSTRAINT ck_coach_role CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
