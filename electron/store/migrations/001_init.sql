-- docs/data-model.md, 2026-10-09. Applied once by electron/store/db.ts and recorded in schema_migration.

CREATE TABLE session (
    id TEXT NOT NULL CONSTRAINT pk_session PRIMARY KEY,
    intention TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    outcome TEXT CONSTRAINT ck_session_outcome CHECK (outcome IS NULL OR outcome IN ('yes', 'not_yet', 'unanswered'))
);
CREATE UNIQUE INDEX ux_session_one_running ON session ((1)) WHERE ended_at IS NULL;

CREATE TABLE declared_target (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL CONSTRAINT fk_declared_session REFERENCES session (id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('work', 'distraction')),
    CONSTRAINT uq_declared_target UNIQUE (session_id, target)
);

CREATE TABLE visit (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL CONSTRAINT fk_visit_session REFERENCES session (id) ON DELETE CASCADE,
    app_name TEXT NOT NULL,
    window_title TEXT,
    url TEXT,
    started_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    ended_at TEXT,
    kind TEXT NOT NULL CHECK (kind IN ('attention', 'away'))
);
CREATE INDEX ix_visit_session_started ON visit (session_id, started_at);

CREATE TABLE memory (
    id TEXT NOT NULL PRIMARY KEY,
    match_key TEXT NOT NULL CONSTRAINT uq_memory_key UNIQUE,
    label TEXT NOT NULL CHECK (label IN ('serves', 'drifts')),
    tap_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE verdict (
    id TEXT NOT NULL PRIMARY KEY,
    visit_id TEXT NOT NULL CONSTRAINT fk_verdict_visit REFERENCES visit (id) ON DELETE CASCADE CONSTRAINT uq_verdict_visit UNIQUE,
    memory_id TEXT CONSTRAINT fk_verdict_memory REFERENCES memory (id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('rule', 'memory', 'model', 'user')),
    label TEXT NOT NULL CONSTRAINT ck_verdict_label CHECK (label IN ('serves', 'drifts', 'unclear')),
    reason TEXT,
    model_id TEXT,
    model_stage TEXT CONSTRAINT ck_verdict_model_stage CHECK (model_stage IS NULL OR model_stage IN ('decide', 'reason')),
    latency_ms INTEGER,
    confidence REAL
);

CREATE TABLE browser_tab (
    id INTEGER NOT NULL CONSTRAINT pk_browser_tab PRIMARY KEY CONSTRAINT ck_browser_tab_id CHECK (id = 1),
    url TEXT,
    title TEXT,
    browser TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE setting (
    key TEXT NOT NULL CONSTRAINT pk_setting PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE eval_case (
    id TEXT NOT NULL PRIMARY KEY,
    fixture TEXT NOT NULL,
    expected_label TEXT NOT NULL CHECK (expected_label IN ('serves', 'drifts', 'unclear'))
);

CREATE TABLE eval_run (
    id TEXT NOT NULL PRIMARY KEY,
    run_id TEXT NOT NULL,
    eval_case_id TEXT NOT NULL CONSTRAINT fk_run_case REFERENCES eval_case (id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    got_label TEXT NOT NULL,
    confidence REAL,
    model_id TEXT,
    model_stage TEXT,
    ran_at TEXT NOT NULL
);
