export type TimedPlan = {kind: "timed", workMin: number, breakMin: number, count: number};
export type OpenPlan = {kind: "open"};
export type Plan = TimedPlan | OpenPlan;

const MIN_COUNT = 1;
const MAX_COUNT = 8;

function assertPresetCount(count: number): void {
    if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT)
        throw new RangeError(`count must be an integer from ${MIN_COUNT} to ${MAX_COUNT}`);
}

export function PRESET_25_5(count: number): TimedPlan {
    assertPresetCount(count);
    return {kind: "timed", workMin: 25, breakMin: 5, count};
}

export function PRESET_50_10(count: number): TimedPlan {
    assertPresetCount(count);
    return {kind: "timed", workMin: 50, breakMin: 10, count};
}

export function lengthMin(plan: TimedPlan): number {
    const {workMin, breakMin, count} = plan;
    return count * workMin + (count - 1) * breakMin;
}

const MS_PER_MIN = 60_000;

export function phaseAt(plan: Plan, elapsedMs: number): {phase: "work" | "break", done: boolean} {
    if (plan.kind === "open")
        return {phase: "work", done: false};

    const totalMs = lengthMin(plan) * MS_PER_MIN;
    const elapsed = Math.max(0, elapsedMs);
    if (elapsed >= totalMs)
        return {phase: "work", done: true};

    const workMs = plan.workMin * MS_PER_MIN;
    const breakMs = plan.breakMin * MS_PER_MIN;
    let remaining = elapsed;

    for (let i = 0; i < plan.count; i++) {
        if (remaining < workMs)
            return {phase: "work", done: false};
        remaining -= workMs;

        if (i < plan.count - 1) {
            if (plan.breakMin === 0)
                continue;
            if (remaining < breakMs)
                return {phase: "break", done: false};
            remaining -= breakMs;
        }
    }

    return {phase: "work", done: true};
}

export function trayWord(input: {phase: "work" | "break" | null, asking: boolean}): "work" | "break" | "?" {
    if (input.asking)
        return "?";
    if (input.phase === null)
        return "work";
    return input.phase;
}
