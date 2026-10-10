CREATE TABLE coach_turn (
    id TEXT NOT NULL CONSTRAINT pk_coach_turn PRIMARY KEY,
    session_id TEXT NOT NULL CONSTRAINT fk_coach_session REFERENCES session(id) ON DELETE CASCADE,
    role TEXT NOT NULL CONSTRAINT ck_coach_role CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX ix_coach_session_created ON coach_turn (session_id, created_at);
