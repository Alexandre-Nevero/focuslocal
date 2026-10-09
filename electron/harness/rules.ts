import type {DeclaredTarget, Label} from "../../src/shared/types.ts";

/** What Harness knows about one closed visit. */
export type WindowFacts = {appName: string, execName: string | null, title: string | null, url: string | null};

/** `WINWORD.exe` → `winword`. */
export const bare = (name: string) => name.toLowerCase().replace(/\.(exe|app)$/, "");

export function hostOf(url: string | null): string | null {
    if (url == null)
        return null;
    try {
        return new URL(url).hostname.toLowerCase() || null;
    } catch {
        return null;
    }
}

const hasWord = (text: string, word: string) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(text);

/**
 * Rules stage (ADR-002, system-design §9). Targets are already lowercase. A target with a dot is a site: the URL host is it
 * or a subdomain of it, or, with no URL, its first label is a word in the title. Any other target is an app: it equals the
 * process name or is a word in the app name (`powerpoint` matches "Microsoft PowerPoint"). A site match beats an app match.
 */
export function ruleLabel(targets: readonly DeclaredTarget[], w: WindowFacts): Label | null {
    const host = hostOf(w.url);
    const title = (w.title ?? "").toLowerCase();
    const exec = w.execName == null ? null : bare(w.execName);
    const appName = w.appName.toLowerCase();

    const site = targets.find(({target}) => target.includes(".") && (host != null
        ? host === target || host.endsWith(`.${target}`)
        : w.url == null && hasWord(title, target.split(".")[0]!)));
    const hit = site ?? targets.find(({target}) => !target.includes(".") && (exec === target || hasWord(appName, target)));
    if (hit == null)
        return null;

    return hit.role === "work" ? "serves" : "drifts";
}
