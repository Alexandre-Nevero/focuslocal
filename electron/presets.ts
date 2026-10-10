export type PresetId = "writing" | "research" | "study" | "admin";

type Preset = {id: PresetId, keywords: string[], block: string[], allow: string[]};

const PRESETS: Preset[] = [
    {id: "writing", keywords: ["pitch", "deck"], block: ["youtube.com"], allow: []},
    {id: "research", keywords: ["research", "sources"], block: ["reddit.com", "twitter.com", "x.com"], allow: []},
    {id: "study", keywords: ["study", "homework", "exam"], block: ["youtube.com", "netflix.com"], allow: []},
    {id: "admin", keywords: ["invoice", "admin"], block: ["reddit.com"], allow: []}
];

const PRESET_IDS = new Set<PresetId>(PRESETS.map((p) => p.id));

const ALL_PRESET_HOSTS = new Set(
    PRESETS.flatMap((p) => [...p.block, ...p.allow]).map(normalizeHost)
);

export function normalizeHost(target: string): string {
    return target.trim().toLowerCase()
        .replace(/^www\./, "");
}

function wholeWordRe(word: string): RegExp {
    return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
}

export function matchPreset(intention: string): PresetId | null {
    for (const preset of PRESETS) {
        if (preset.keywords.some((kw) => wholeWordRe(kw).test(intention)))
            return preset.id;
    }
    return null;
}

function looksLikeSite(text: string): boolean {
    if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(text))
        return true;
    return ALL_PRESET_HOSTS.has(normalizeHost(text));
}

export function acceptPresetAnswer(text: string): PresetId | "none" | null {
    const answer = text.trim().toLowerCase();
    if (answer === "none")
        return "none";
    if (PRESET_IDS.has(answer as PresetId))
        return answer as PresetId;
    if (looksLikeSite(answer))
        return null;
    return null;
}

const HOST_IN_TEXT = /\b(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)\b/gi;

function hostsNamedInIntention(intention: string): Set<string> {
    const hosts = new Set<string>();
    for (const match of intention.matchAll(HOST_IN_TEXT))
        hosts.add(normalizeHost(match[1]!));
    return hosts;
}

function presetById(id: PresetId | null): Preset | null {
    if (id == null)
        return null;
    return PRESETS.find((p) => p.id === id) ?? null;
}

function isRemoved(target: string, removed: Set<string>): boolean {
    const host = normalizeHost(target);
    return removed.has(host);
}

export function fillBlock(input: {
    intention: string,
    savedBlock: string[],
    work: string[],
    preset: PresetId | null
}): string[] {
    const preset = presetById(input.preset);
    const removed = new Set<string>([
        ...hostsNamedInIntention(input.intention),
        ...input.work.map(normalizeHost),
        ...(preset?.allow ?? []).map(normalizeHost)
    ]);

    const seen = new Set<string>();
    const out: string[] = [];
    for (const target of [...input.savedBlock, ...(preset?.block ?? [])]) {
        const key = normalizeHost(target);
        if (seen.has(key) || isRemoved(target, removed))
            continue;
        seen.add(key);
        out.push(target);
    }
    return out;
}
