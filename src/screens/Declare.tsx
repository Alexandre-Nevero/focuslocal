import {useEffect, useId, useState} from "react";
import {ErrorNote, ListEditor} from "../components.tsx";
import {errorText, go, ledger, useLoad} from "../ledger.ts";
import type {DeclaredTarget, Permissions} from "../shared/types.ts";

const granted = (p: Permissions) => p.screen === "granted" && p.accessibility === "granted";

/** Today's lists carry over from a block started earlier today, so a second block does not retype them. */
async function todaysTargets(): Promise<DeclaredTarget[]> {
    const rows = await ledger.history.list();
    const last = rows.find((row) => row.endedAt != null);
    if (last == null || new Date(last.startedAt).toDateString() !== new Date().toDateString())
        return [];

    return (await ledger.review.get(last.id)).session.targets;
}

/** Intention, the two lists, Start. Start never waits on a model, and an empty intention is a stored state (US-001). */
export function Declare() {
    const [permissions] = useLoad(() => ledger.permissions.get(), []);
    const [intention, setIntention] = useState("");
    const [work, setWork] = useState<string[]>([]);
    const [distraction, setDistraction] = useState<string[]>([]);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fieldId = useId();

    useEffect(() => {
        todaysTargets().then((targets) => {
            setWork(targets.filter((t) => t.role === "work").map((t) => t.target));
            setDistraction(targets.filter((t) => t.role === "distraction").map((t) => t.target));
        }, () => undefined);
    }, []);

    const allowed = permissions.state === "ready" && granted(permissions.value);

    // One target lives on one list: adding it to one removes it from the other.
    const setOnly = (role: "work" | "distraction") => (items: string[]) => {
        if (role === "work") {
            setWork(items);
            setDistraction((d) => d.filter((i) => !items.includes(i)));
        } else {
            setDistraction(items);
            setWork((w) => w.filter((i) => !items.includes(i)));
        }
    };

    const start = async (event: {preventDefault(): void}) => {
        event.preventDefault();
        if (!allowed || starting)
            return;

        setStarting(true);
        setError(null);
        try {
            await ledger.session.start({
                intention,
                targets: [
                    ...work.map((target): DeclaredTarget => ({target, role: "work"})),
                    ...distraction.map((target): DeclaredTarget => ({target, role: "distraction"}))
                ]
            });
            go("running");
        } catch (err) {
            setError(errorText(err));
            setStarting(false);
        }
    };

    return (
        <main className="declare">
            <form className="declare-form" onSubmit={(e) => void start(e)}>
                {/* First, so the reason Start is disabled is on screen in the 420px popover. */}
                {permissions.state === "ready" && !allowed && (
                    <ErrorNote title="Ledger cannot see windows yet.">
                        Without the permission nothing is recorded.{" "}
                        <button type="button" className="link" onClick={() => go("permissions")}>Set up the permission</button>
                    </ErrorNote>
                )}
                <div className="intention-field">
                    <label htmlFor={fieldId} className="field-label">What do you mean to finish?</label>
                    <textarea
                        id={fieldId}
                        className="intention-input"
                        rows={3}
                        value={intention}
                        autoFocus
                        placeholder="Send the invoice and draft the brief"
                        onChange={(e) => setIntention(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                                void start(e);
                        }}
                    />
                    <p className="hint">One sentence is enough. Blank is allowed; the review will say there was nothing to hold it against.</p>
                </div>

                <ListEditor
                    role="work"
                    title="Work today"
                    items={work}
                    onChange={setOnly("work")}
                    hint="Apps or sites that are the work. Ledger labels these without asking the model."
                    placeholder="figma, docs.google.com"
                />
                <ListEditor
                    role="distraction"
                    title="Drift today"
                    items={distraction}
                    onChange={setOnly("distraction")}
                    hint="Apps or sites that pull you away today."
                    placeholder="youtube.com"
                />

                {permissions.state === "error" && <ErrorNote title="The permission state could not be read." error={permissions.error} />}
                {error != null && <ErrorNote title="The block did not start." error={error} />}

                <div className="declare-actions">
                    <button type="submit" className="btn btn-primary btn-block" disabled={!allowed || starting}>
                        {starting ? "Starting…" : "Start"}
                    </button>
                    <button type="button" className="link" onClick={() => go("idle")}>Back</button>
                </div>
            </form>
        </main>
    );
}
