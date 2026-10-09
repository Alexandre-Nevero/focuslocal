import {useState, type ReactNode} from "react";
import {ConfirmStep, ErrorNote, Page} from "../components.tsx";
import {dayLabel, modelStatusWord, timeOfDay} from "../format.ts";
import {go, ledger, useLoad} from "../ledger.ts";
import {themes, useTheme, type Theme} from "../theme.ts";
import {Switches} from "./Switches.tsx";
import type {Privacy as PrivacyFacts} from "../shared/types.ts";

type Tone = "on" | "pending" | "off";

const themeWord: Record<Theme, string> = {system: "Auto", light: "Light", dark: "Dark"};

function Badge({tone, children}: {tone: Tone, children: ReactNode}) {
    return <span className="badge" data-tone={tone}><span className="badge-dot" aria-hidden="true" />{children}</span>;
}

function modelTone({modelStatus}: PrivacyFacts): Tone {
    if (modelStatus === "ready")
        return "on";
    return modelStatus === "loading" ? "pending" : "off";
}

/** One settings row: name and plain explanation at left, the value or control at right. */
function Setting({name, description, children}: {name: string, description?: ReactNode, children: ReactNode}) {
    return (
        <div className="setting">
            <div className="setting-text">
                <p className="setting-name">{name}</p>
                {description != null && <p className="setting-desc">{description}</p>}
            </div>
            <div className="setting-value">{children}</div>
        </div>
    );
}

function Group({id, title, span = false, children}: {id: string, title: string, span?: boolean, children: ReactNode}) {
    return (
        <section className={span ? "card settings-group settings-span" : "card settings-group"} aria-labelledby={id}>
            <h2 id={id} className="card-title">{title}</h2>
            <div className="settings-rows">{children}</div>
        </section>
    );
}

function CopyPath({path}: {path: string}) {
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(path);
            setState("copied");
        } catch {
            setState("failed");
        }
        window.setTimeout(() => setState("idle"), 2000);
    };
    return (
        <button type="button" className="btn btn-quiet btn-small" onClick={() => void copy()} aria-live="polite">
            {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy location"}
        </button>
    );
}

function labelsLine(facts: PrivacyFacts) {
    if (facts.modelStatus === "ready")
        return "Twofold sorts your windows right here on this computer. When it isn't sure, it asks you.";
    if (facts.modelStatus === "loading")
        return "Twofold is getting ready to sort your windows. You can start a session now.";
    return "Automatic sorting isn't available right now. You can still label every window yourself.";
}

/**
 * Settings for everyday use first, in plain words. The checkable machine facts (model file, threshold, evaluation,
 * file location) stay available, folded under "Technical details" (US-008, US-009).
 */
export function Privacy() {
    const [load, reload] = useLoad(() => ledger.privacy.get(), []);
    const [theme, setTheme] = useTheme();
    const [settings, reloadSettings] = useLoad(() => ledger.settings.get(), []);

    return (
        <Page current="privacy">
            <header className="page-head">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-sub">Everything Twofold keeps stays on this computer.</p>
                </div>
            </header>

            <div className="settings">
                <Group id="set-appearance" title="Appearance">
                    <Setting name="Theme" description="Auto matches your computer.">
                        <div className="segmented" role="group" aria-label="Theme">
                            {themes.map((t) => (
                                <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>{themeWord[t]}</button>
                            ))}
                        </div>
                    </Setting>
                </Group>

                {settings.state === "ready" && (
                    <Group id="set-features" title="Features">
                        <Switches
                            judge={settings.value.judge}
                            coach={settings.value.coach}
                            companion={settings.value.companion}
                            onChange={(key, on) => void ledger.settings.set(key, on).then(() => reloadSettings())}
                        />
                    </Group>
                )}

                {load.state === "loading" && <div className="skeleton skeleton-list" aria-label="Loading settings…" />}
                {load.state === "error" && <ErrorNote title="Settings couldn't load." error={load.error}>Close this window and open it again.</ErrorNote>}

                {load.state === "ready" && (
                    <>
                        <Group id="set-privacy" title="Privacy">
                            <Setting
                                name="Your activity stays private"
                                description="Twofold is blocked from the internet. The apps and pages you use are never sent anywhere."
                            >
                                <Badge tone="on">Private</Badge>
                            </Setting>
                            <Setting name="Automatic labels" description={labelsLine(load.value)}>
                                <Badge tone={modelTone(load.value)}>{modelStatusWord(load.value.modelStatus)}</Badge>
                            </Setting>
                        </Group>

                        <Group id="set-data" title="Your data" span>
                            <ConfirmStep
                                title="Forget what Twofold learned"
                                action="Forget"
                                consequence="Twofold remembers how you labelled windows so it can ask less often. This clears that. Your sessions stay."
                                confirmLabel="Forget"
                                doneText="Done. Twofold will ask about windows again."
                                failText="That didn't work. Nothing was changed."
                                onConfirm={async () => {
                                    await ledger.privacy.dropMemory();
                                    reload();
                                }}
                            />
                            <ConfirmStep
                                title="Delete all my data"
                                action="Delete"
                                consequence="Removes every session and label from this computer. Twofold starts fresh next time it opens."
                                confirmLabel="Delete everything"
                                doneText="Deleted."
                                failText="Your data wasn't deleted. Close Twofold and try again."
                                onConfirm={async () => {
                                    await ledger.privacy.deleteFile();
                                    go("dashboard");
                                }}
                            />
                        </Group>

                        <details className="card settings-group settings-details">
                            <summary className="card-title">Technical details</summary>
                            <p className="settings-note">For checking what Twofold runs. You don't need any of this day to day.</p>
                            <div className="settings-rows">
                                <Setting name="Model" description={load.value.modelId ?? "No model file loaded"}>
                                    <span className="setting-fact">{load.value.modelCalls} windows labelled</span>
                                </Setting>
                                <Setting
                                    name="Confidence bar"
                                    description="The review shows the label Twofold stored."
                                >
                                    <span className="setting-fact">{load.value.tau ?? "Not set"}</span>
                                </Setting>
                                <Setting name="Evaluation" description={<>Run with <code>npm run eval</code>.</>}>
                                    <span className="setting-fact">
                                        {load.value.evalRanAt == null ? "Not run" : `${dayLabel(load.value.evalRanAt)}, ${timeOfDay(load.value.evalRanAt)}`}
                                    </span>
                                </Setting>
                                <Setting name="Data file" description={<code className="path">{load.value.dbPath}</code>}>
                                    <CopyPath path={load.value.dbPath} />
                                </Setting>
                                <p className="settings-note">
                                    The network block is enforced by the app. It doesn't measure traffic; use an outside monitor for that.
                                </p>
                            </div>
                        </details>
                    </>
                )}
            </div>
        </Page>
    );
}
