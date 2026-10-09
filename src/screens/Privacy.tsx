import {ConfirmStep, ErrorNote, Page} from "../components.tsx";
import {capital, counted, dayLabel, timeOfDay} from "../format.ts";
import {go, ledger, useLoad} from "../ledger.ts";
import type {Privacy as PrivacyFacts} from "../shared/types.ts";

function modelLine({modelId, modelStatus}: PrivacyFacts) {
    if (modelId != null)
        return modelId;
    if (modelStatus === "loading")
        return "Loading the on-device model.";
    if (modelStatus === "missing-file")
        return "None configured. The model file is not on this machine.";

    return `Did not load: ${modelStatus.replace(/^failed:/, "")}`;
}

/** What the app ran and where the file is, stated as facts the person can check (US-008, US-009). */
export function Privacy() {
    const [load, reload] = useLoad(() => ledger.privacy.get(), []);

    return (
        <Page current="privacy">
            <header className="screen-head">
                <h1 className="screen-title">What stayed on this machine</h1>
            </header>

            {load.state === "loading" && <p className="status">Reading the local file…</p>}
            {load.state === "error" && <ErrorNote title="The local file could not be read." error={load.error} />}
            {load.state === "ready" && (
                <>
                    <dl className="spec spec-sheet">
                        <div>
                            <dt>Network</dt>
                            <dd>This build has no network client.</dd>
                        </div>
                        <div>
                            <dt>Model calls</dt>
                            <dd>{capital(counted(load.value.modelCalls, "verdict"))} came from the on-device model.</dd>
                        </div>
                        <div>
                            <dt>Model</dt>
                            <dd>{modelLine(load.value)}</dd>
                        </div>
                        <div>
                            <dt>Display bar</dt>
                            <dd>
                                {load.value.tau == null
                                    ? "No eval has set a bar yet, so every model label shows as Unclear."
                                    : `A model label shows only at confidence ${load.value.tau} or above. Below that it shows as Unclear.`}
                            </dd>
                        </div>
                        <div>
                            <dt>Eval</dt>
                            <dd>
                                {load.value.evalRanAt == null
                                    ? "Not run."
                                    : `Last run ${dayLabel(load.value.evalRanAt)} at ${timeOfDay(load.value.evalRanAt)}.`}
                                {" "}<span className="quiet">Run it with <code>npm run eval</code>. Results print in the terminal.</span>
                            </dd>
                        </div>
                        <div>
                            <dt>Local file</dt>
                            <dd><code className="path">{load.value.dbPath}</code></dd>
                        </div>
                    </dl>
                    <p className="hint spec-note">
                        These lines count rows in the local file. The panel does not watch network traffic and would not notice a
                        dependency that phones home; use a monitor outside the app for byte counts.
                    </p>

                    <section className="danger" aria-labelledby="danger-heading">
                        <h2 id="danger-heading" className="section-title">Remove</h2>
                        <ConfirmStep
                            action="Drop memory"
                            consequence="Forget every label learned from your taps. Past visits keep the labels they already have."
                            confirmLabel="Drop memory"
                            doneText="Memory dropped. Past visits kept their labels."
                            failText="Memory was not dropped."
                            onConfirm={async () => {
                                await ledger.privacy.dropMemory();
                                reload();
                            }}
                        />
                        <ConfirmStep
                            action="Delete the local file"
                            consequence="Delete the file on this machine that holds every block, visit, and label. The next launch starts empty."
                            confirmLabel="Delete the file"
                            doneText="Deleted."
                            failText={`Delete failed. The file is still at ${load.value.dbPath}.`}
                            onConfirm={async () => {
                                await ledger.privacy.deleteFile();
                                go("idle");
                            }}
                        />
                    </section>
                </>
            )}
        </Page>
    );
}
