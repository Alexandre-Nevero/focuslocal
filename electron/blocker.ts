import {randomUUID} from "node:crypto";
import {bare} from "./harness/rules.ts";
import {getDb} from "./store/db.ts";

const stripWww = (host: string) => (host.startsWith("www.") ? host.slice(4) : host);

/** Same host compare as `ruleLabel` site targets in harness/rules.ts. */
const siteMatches = (host: string, pattern: string) => {
    const h = stripWww(host.toLowerCase());
    const p = stripWww(pattern.toLowerCase());
    return h === p || h.endsWith(`.${p}`);
};

const HOST_RE =
    /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/gi;

export function hostsIn(text: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const match of text.matchAll(HOST_RE)) {
        const host = stripWww(match[1]!.toLowerCase());
        if (seen.has(host))
            continue;
        seen.add(host);
        out.push(host);
    }
    return out;
}

const onList = (target: string, kind: "site" | "app", list: string[], role: "site" | "app") => {
    if (kind !== role)
        return false;
    if (role === "site")
        return list.some((entry) => entry.includes(".") && siteMatches(target, entry));
    const key = bare(target.toLowerCase());
    return list.some((entry) => !entry.includes(".") && bare(entry) === key);
};

export function decision(input: {
    target: string,
    kind: "site" | "app",
    work: string[],
    block: string[],
    intention: string
}): "allow" | "block" {
    const {target, kind, work, block, intention} = input;
    if (onList(target, kind, work, kind))
        return "allow";
    if (kind === "site" && hostsIn(intention).some((host) => siteMatches(target, host)))
        return "allow";
    if (onList(target, kind, block, kind))
        return "block";
    return "allow";
}

export function recordHit(sessionId: string, target: string, kind: "site" | "app"): boolean {
    const result = getDb()
        .prepare("INSERT OR IGNORE INTO block_hit (id, session_id, target, kind, reached_at) VALUES (?, ?, ?, ?, ?)")
        .run(randomUUID(), sessionId, target, kind, new Date().toISOString());
    return result.changes > 0;
}

export function judgeEnabled(phase: "work" | "break" | null): boolean {
    return phase !== "break";
}
