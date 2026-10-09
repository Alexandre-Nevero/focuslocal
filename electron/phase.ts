import {getDb} from "./store/db.ts";
import {phaseAt, trayWord, type TimedPlan} from "./cycle.ts";
import {endRunningSession} from "./ipc.ts";
import {setTrayTip} from "./windows.ts";

export function watchPhase(): void {
    const db = getDb();
    const row = db.prepare("SELECT id, started_at, work_min, break_min, cycle_count FROM session WHERE ended_at IS NULL")
        .get();
    if (row == null) {
        setTrayTip("Twofold");
        return;
    }
    if (row.work_min == null) {
        setTrayTip("work");
        return;
    }

    try {
        const plan: TimedPlan = {
            kind: "timed",
            workMin: Number(row.work_min),
            breakMin: Number(row.break_min),
            count: Number(row.cycle_count)
        };
        const elapsed = Date.now() - Date.parse(String(row.started_at));
        const {phase, done} = phaseAt(plan, elapsed);
        if (done) {
            void endRunningSession();
            return;
        }
        setTrayTip(trayWord({phase, asking: false}));
        db.prepare("UPDATE session SET phase = ? WHERE id = ?").run(phase, String(row.id));
    } catch {
        /* phase column missing on an old file */
    }
}
