// `npm run eval [fixtures.json]`: scores held-out fixtures through the full Harness and sets tau (US-009,
// system-design §9 "τ (eval)"). Runs under ELECTRON_RUN_AS_NODE (scripts/eval.mjs), so no Electron imports anywhere below.
import fs from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {getDb, closeDb} from "../store/db.ts";
import {dbPath} from "../paths.ts";
import {loadJudge, MODEL_FILE} from "../ai/judge.ts";
import {labelWindow} from "../harness/harness.ts";
import type {DeclaredTarget, Label, Source} from "../../src/shared/types.ts";

// The precision bar is owned by idea.md §9; this is its value, not a second definition.
const PRECISION_BAR = 0.8;
const MIN_ASSERTED = 10;
const TAU_GRID = Array.from({length: 19}, (_, i) => Math.round((i + 1) * 5) / 100);

type Fixture = {
    id: string,
    intention: string,
    targets?: DeclaredTarget[],
    app: string,
    exec?: string,
    title: string,
    url: string | null,
    expected: Label
};
type Scored = {source: Source, label: Label, confidence: number | null, expected: Label};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesPath = path.resolve(process.argv[2] ?? path.join(root, "eval", "fixtures.json"));
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8")) as Fixture[];

console.log(`Loading ${MODEL_FILE}…`);
const judge = await loadJudge(path.join(root, "models", MODEL_FILE));
const db = getDb();
const runId = randomUUID();
const scored: Scored[] = [];

for (const f of fixtures) {
    // A throwaway session per case: targets from the fixture, no memory. User visits are never read or written.
    const v = await labelWindow(
        {intention: f.intention, targets: (f.targets ?? []).map((t) => ({...t, target: t.target.toLowerCase()}))},
        {appName: f.app, execName: f.exec ?? null, title: f.title, url: f.url},
        () => null,
        judge
    );
    db.prepare(`
        INSERT INTO eval_case (id, fixture, expected_label) VALUES (?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET fixture = excluded.fixture, expected_label = excluded.expected_label
    `).run(f.id, JSON.stringify(f), f.expected);
    db.prepare(`
        INSERT INTO eval_run (id, run_id, eval_case_id, source, got_label, confidence, model_id, model_stage, ran_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), runId, f.id, v.source, v.label, v.confidence, v.modelId, v.modelStage, new Date().toISOString());
    scored.push({source: v.source, label: v.label, confidence: v.confidence, expected: f.expected});
}

const precision = (rows: Scored[]) => {
    const asserted = rows.filter((r) => r.label !== "unclear");
    const correct = asserted.filter((r) => r.label === r.expected).length;
    return {asserted: asserted.length, correct, precision: asserted.length === 0 ? null : correct / asserted.length};
};

console.log(`\n${fixtures.length} cases from ${fixturesPath}, run ${runId}`);
for (const source of ["rule", "memory", "model"] as const) {
    const rows = scored.filter((r) => r.source === source);
    const p = precision(rows);
    console.log(`${source.padEnd(7)} cases ${String(rows.length).padStart(3)}  asserted ${String(p.asserted).padStart(3)}  ` +
        `correct ${String(p.correct).padStart(3)}  precision ${p.precision?.toFixed(2) ?? "—"}`);
}

// tau: the smallest grid value where model precision over confidence >= tau meets the bar with enough asserted.
const model = scored.filter((r) => r.source === "model");
let tau: number | null = null;
for (const t of TAU_GRID) {
    const p = precision(model.filter((r) => r.confidence != null && r.confidence >= t));
    console.log(`  tau ${t.toFixed(2)}: asserted ${p.asserted}, precision ${p.precision?.toFixed(2) ?? "—"}`);
    if (tau == null && p.asserted >= MIN_ASSERTED && p.precision != null && p.precision >= PRECISION_BAR)
        tau = t;
}

if (tau == null) {
    db.prepare("DELETE FROM setting WHERE key = 'tau'").run();
    console.log(`\nNo tau reaches precision ${PRECISION_BAR} with ${MIN_ASSERTED}+ asserted: every model label shows as unclear.`);
} else {
    db.prepare("INSERT INTO setting (key, value) VALUES ('tau', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
        .run(String(tau));
    console.log(`\ntau = ${tau.toFixed(2)} written to ${dbPath()}`);
}

closeDb();
await judge.llama.dispose();
