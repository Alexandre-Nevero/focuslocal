import {randomUUID} from "node:crypto";
import {automaticLabel} from "../harness/rules.ts";
import {memoryKey} from "../harness/memory.ts";
import type {DatabaseSync} from "node:sqlite";
import type {DeclaredTarget, Label, Outcome, Review, ReviewVisit, Session, Source, Verdict} from "../../src/shared/types.ts";

type Row = Record<string, unknown>;
const str = (value: unknown) => (value == null ? null : String(value));
const num = (value: unknown) => (value == null ? null : Number(value));
const durationMs = (from: string, to: string) => Math.max(0, Date.parse(to) - Date.parse(from));

function readSession(db: DatabaseSync, row: Row): Session {
    const targets = db.prepare("SELECT target, role FROM declared_target WHERE session_id = ? ORDER BY rowid")
        .all(String(row.id))
        .map((target) => ({target: String(target.target), role: target.role}) as DeclaredTarget);
    return {
        id: String(row.id),
        intention: String(row.intention),
        startedAt: String(row.started_at),
        endedAt: str(row.ended_at),
        outcome: str(row.outcome) as Outcome | null,
        targets
    };
}

/** Read the desktop review representation from any open Store connection. */
export function readReview(db: DatabaseSync, sessionId: string): Review {
    const sessionRow = db.prepare("SELECT * FROM session WHERE id = ?").get(sessionId);
    if (sessionRow == null)
        throw new Error(`No session ${sessionId}`);
    const session = readSession(db, sessionRow);
    const tauRow = db.prepare("SELECT value FROM setting WHERE key = 'tau'").get();
    const tau = tauRow == null ? null : Number(tauRow.value);
    const rows = db.prepare(`
        SELECT v.*, d.id AS d_id, d.memory_id, d.source, d.label, d.reason, d.model_id, d.model_stage, d.latency_ms, d.confidence
        FROM visit v LEFT JOIN verdict d ON d.visit_id = v.id
        WHERE v.session_id = ? ORDER BY v.started_at
    `).all(sessionId);
    const visits = rows.map((row): ReviewVisit => {
        const verdict: Verdict | null = row.d_id == null ? null : {
            id: String(row.d_id),
            visitId: String(row.id),
            memoryId: str(row.memory_id),
            source: String(row.source) as Source,
            label: String(row.label) as Label,
            reason: str(row.reason),
            modelId: str(row.model_id),
            modelStage: str(row.model_stage) as Verdict["modelStage"],
            latencyMs: num(row.latency_ms),
            confidence: num(row.confidence)
        };
        const gated = verdict?.source === "model" && (tau == null || verdict.confidence == null || verdict.confidence < tau);
        const fallback = automaticLabel(session, {
            appName: String(row.app_name), execName: str(row.exec_name), title: str(row.window_title), url: str(row.url)
        });
        const useFallback = verdict == null || gated || verdict.label === "unclear";
        return {
            id: String(row.id),
            sessionId,
            appName: String(row.app_name),
            windowTitle: str(row.window_title),
            url: str(row.url),
            startedAt: String(row.started_at),
            lastSeenAt: String(row.last_seen_at),
            endedAt: str(row.ended_at),
            kind: row.kind === "away" ? "away" : "attention",
            verdict,
            shown: row.kind === "away" ? null : useFallback ? fallback : verdict!.label,
            shownSource: row.kind === "away" ? null : useFallback ? "rule" : verdict!.source
        };
    });
    const sessionEnd = session.endedAt ?? new Date().toISOString();
    const recordedMs = visits.reduce((sum, visit) => sum + durationMs(visit.startedAt, visit.endedAt ?? visit.lastSeenAt), 0);
    return {session, visits, unrecordedMs: Math.max(0, durationMs(session.startedAt, sessionEnd) - recordedMs)};
}

/** Apply one user review correction with the same memory vote bookkeeping as desktop review taps. */
export function tapVisit(db: DatabaseSync, visitId: string, label: "serves" | "drifts"): void {
    const visit = db.prepare("SELECT app_name, exec_name, window_title, url FROM visit WHERE id = ?").get(visitId);
    if (visit == null)
        throw new Error(`No visit ${visitId}`);
    db.exec("BEGIN");
    try {
        db.prepare(`
            INSERT INTO verdict (id, visit_id, source, label) VALUES (?, ?, 'user', ?)
            ON CONFLICT (visit_id) DO UPDATE SET source = 'user', label = excluded.label, memory_id = NULL, reason = NULL,
                model_id = NULL, model_stage = NULL, latency_ms = NULL, confidence = NULL
        `).run(randomUUID(), visitId, label);
        const matchKey = memoryKey({
            appName: String(visit.app_name), execName: str(visit.exec_name),
            title: str(visit.window_title), url: str(visit.url)
        });
        if (matchKey != null) {
            const previous = db.prepare("SELECT id, label FROM memory WHERE match_key = ?").get(matchKey);
            if (previous != null && previous.label !== label)
                db.prepare("UPDATE verdict SET memory_vote_id = NULL WHERE memory_vote_id = ?").run(String(previous.id));
            const learned = db.prepare(`
                INSERT INTO memory (id, match_key, label, tap_count) VALUES (?, ?, ?, 0)
                ON CONFLICT (match_key) DO UPDATE SET
                    tap_count = CASE WHEN label = excluded.label THEN tap_count ELSE 0 END,
                    label = excluded.label
                RETURNING id
            `).get(randomUUID(), matchKey, label)!;
            const memoryId = String(learned.id);
            const vote = db.prepare("UPDATE verdict SET memory_vote_id = ? WHERE visit_id = ? AND memory_vote_id IS NOT ?")
                .run(memoryId, visitId, memoryId);
            if (vote.changes > 0)
                db.prepare("UPDATE memory SET tap_count = tap_count + 1 WHERE id = ?").run(memoryId);
        }
        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}

/** Update an existing session intention without changing its stored review or finish outcome. */
export function updateSessionIntention(db: DatabaseSync, sessionId: string, intention: string): string {
    const trimmed = intention.trim();
    const result = db.prepare("UPDATE session SET intention = ? WHERE id = ?").run(trimmed, sessionId);
    if (result.changes === 0)
        throw new Error(`No session ${sessionId}`);
    return trimmed;
}
