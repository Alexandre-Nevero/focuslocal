import {useCallback, useState} from "react";
import {errorText, ledger, useLoad} from "../ledger.ts";
import {CompanionPopup} from "./CompanionPopup.tsx";

export function Companion() {
    const [session] = useLoad(() => ledger.session.current(), [], ["session:changed"]);
    const [history] = useLoad(() => ledger.history.list(), [], ["session:changed"]);
    const [expanded, setExpanded] = useState(false);
    const [coachText, setCoachText] = useState<string | null>(null);
    const [coachError, setCoachError] = useState<string | null>(null);

    const running = session.state === "ready" ? session.value : null;
    const rows = history.state === "ready" ? history.value : [];
    const latestEnded = rows.find((row) => row.endedAt != null);
    const hasEnded = latestEnded != null;

    const onToggle = useCallback(() => {
        setExpanded((on) => {
            const next = !on;
            void ledger.companion.resize(next);
            return next;
        });
    }, []);

    const onDrag = useCallback((dx: number, dy: number) => {
        void ledger.companion.nudge(dx, dy);
    }, []);

    const onAsk = useCallback(async (text: string) => {
        if (latestEnded == null)
            return;
        setCoachError(null);
        try {
            const {reply} = await ledger.coach.ask(latestEnded.id, text);
            setCoachText(reply);
        } catch (err) {
            setCoachError(errorText(err));
        }
    }, [latestEnded]);

    return (
        <>
            <CompanionPopup
                mode={running != null ? "running" : "idle"}
                intention={running?.intention ?? latestEnded?.intention ?? ""}
                startedAt={running?.startedAt ?? null}
                coachText={coachError ?? coachText}
                hasEnded={hasEnded}
                expanded={expanded}
                onToggle={onToggle}
                onDrag={onDrag}
                onEnd={() => void ledger.session.end()}
                onNotWork={() => void ledger.companion.notWork()}
                onAsk={(text) => void onAsk(text)}
            />
        </>
    );
}
