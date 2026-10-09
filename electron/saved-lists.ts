import {getDb} from "./store/db.ts";

type SwitchKey = "judge" | "coach" | "companion";

export function listSaved(): {target: string, role: "work" | "block"}[] {
    return getDb().prepare("SELECT target, role FROM saved_target ORDER BY target")
        .all()
        .map((row) => ({target: String(row.target), role: row.role as "work" | "block"}));
}

export function saveTarget(target: string, role: "work" | "block"): void {
    getDb().prepare(
        "INSERT INTO saved_target (target, role) VALUES (?, ?) ON CONFLICT (target) DO UPDATE SET role = excluded.role"
    )
        .run(target, role);
}

export function removeTarget(target: string): void {
    getDb().prepare("DELETE FROM saved_target WHERE target = ?")
        .run(target);
}

export function readSwitch(key: SwitchKey): boolean {
    const row = getDb().prepare("SELECT value FROM setting WHERE key = ?")
        .get(key);
    if (row == null)
        return true;
    return String(row.value) !== "off";
}

export function writeSwitch(key: SwitchKey, on: boolean): void {
    getDb().prepare(
        "INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"
    )
        .run(key, on ? "on" : "off");
}
