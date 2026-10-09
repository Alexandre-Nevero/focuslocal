export function Switches({judge, coach, companion, onChange}: {
    judge: boolean,
    coach: boolean,
    companion: boolean,
    onChange(key: "judge" | "coach" | "companion", on: boolean): void
}) {
    const row = (key: "judge" | "coach" | "companion", label: string, on: boolean) => (
        <label className="switch-row">
            <input
                type="checkbox"
                checked={on}
                onChange={(e) => onChange(key, e.target.checked)}
            />
            <span>{label}</span>
        </label>
    );

    return (
        <fieldset className="switches">
            <legend>Features</legend>
            {row("judge", "Judge", judge)}
            {row("coach", "Coach", coach)}
            {row("companion", "Companion", companion)}
        </fieldset>
    );
}
