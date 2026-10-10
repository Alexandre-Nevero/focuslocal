import type {DatabaseSync} from "node:sqlite";

/** Preserve pre-coach conversations while moving the old `text` field to the current name. */
export function repairCoachTurnContent(db: DatabaseSync): void {
    const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'coach_turn'").get();
    if (!table)
        return;
    const columns = new Set(db.prepare("PRAGMA table_info(coach_turn)").all()
        .map((row) => String(row.name)));
    if (!columns.has("content") && columns.has("text")) {
        db.exec("ALTER TABLE coach_turn RENAME COLUMN text TO content");
        columns.delete("text");
        columns.add("content");
    }
    const required = ["id", "session_id", "role", "content", "created_at"];
    const missing = required.filter((column) => !columns.has(column));
    if (missing.length > 0)
        throw new Error(`Cannot migrate coach_turn: missing expected columns (${missing.join(", ")})`);
}

export function hasCoachTurnTable(db: DatabaseSync): boolean {
    return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'coach_turn'").get());
}
