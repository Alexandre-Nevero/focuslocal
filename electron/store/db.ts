import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {dbPath, ledgerDir} from "../paths.ts";
import {hasCoachTurnTable, repairCoachTurnContent} from "./coach-migration.ts";

// Bundled into the main build as strings, applied in filename order.
const migrations = Object.entries(
    import.meta.glob<string>("./migrations/*.sql", {query: "?raw", import: "default", eager: true})
)
    .map(([file, sql]) => ({name: file.slice(file.lastIndexOf("/") + 1), sql}))
    .sort((a, b) => a.name.localeCompare(b.name));

let db: DatabaseSync | null = null;

/** The one connection main uses. Opens the file and migrates on first use. */
export function getDb(): DatabaseSync {
    if (db != null)
        return db;

    fs.mkdirSync(ledgerDir(), {recursive: true});
    const opened = new DatabaseSync(dbPath());
    opened.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=2000; PRAGMA foreign_keys=ON;");
    opened.exec("CREATE TABLE IF NOT EXISTS schema_migration (name TEXT NOT NULL CONSTRAINT pk_schema_migration PRIMARY KEY, applied_at TEXT NOT NULL)");
    const coachTurnExisted = hasCoachTurnTable(opened);
    if (coachTurnExisted)
        repairCoachTurnContent(opened);

    const applied = new Set(
        opened.prepare("SELECT name FROM schema_migration").all()
            .map((row) => String(row.name))
    );
    for (const {name, sql} of migrations) {
        if (applied.has(name))
            continue;

        opened.exec("BEGIN");
        try {
            if (name === "008_coach_turn_content.sql")
                repairCoachTurnContent(opened);
            else if (name === "004_coach_turn.sql" && coachTurnExisted)
                opened.exec("CREATE INDEX IF NOT EXISTS ix_coach_session_created ON coach_turn (session_id, created_at)");
            else
                opened.exec(sql);
            opened.prepare("INSERT INTO schema_migration (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
            opened.exec("COMMIT");
        } catch (err) {
            opened.exec("ROLLBACK");
            opened.close();
            throw err;
        }
    }

    db = opened;
    return db;
}

/** Closes the connection so the file can be deleted (US-008). The next getDb() reopens and re-creates it. */
export function closeDb() {
    db?.close();
    db = null;
}
