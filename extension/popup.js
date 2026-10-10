const $ = (id) => document.getElementById(id);
const dateMs = (value) => (typeof value === "string" ? Date.parse(value) : NaN);
const minute = 60000;
let snapshot = null;
let selected = null;
let dirty = false;
let busy = false;
let loading = false;
let starting = false;
let declaring = false;
let clockTimer = null;

function request(action, values = {}) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({type: "popup", action, ...values}, (reply) => {
            const error = chrome.runtime.lastError;
            resolve(error ? {error: "unavailable"} : reply ?? {error: "unavailable"});
        });
    });
}

function formatMinutes(ms) {
    if (ms > 0 && ms < minute) return "<1 min";
    return `${Math.max(0, Math.round(ms / minute))} min`;
}

function hostName(visit) {
    if (visit.kind === "away") return "Away";
    try {
        const host = visit.url ? new URL(visit.url).hostname.replace(/^www\./, "") : "";
        if (host) return host;
    } catch {
        // A missing URL keeps the recorded app name.
    }
    return visit.appName || "Window";
}

function setBusy(value) {
    busy = value;
    document.querySelectorAll("[data-outcome], #clear-answer, #intention-save, #intention-cancel, #end-session, #start-session, .visit-toggle")
        .forEach((button) => button.disabled = value);
    $("intention").readOnly = value;
    $("start-session").disabled = value || starting;
}

function showUnavailable() {
    $("state").hidden = true;
    $("session").hidden = true;
    $("start-form").hidden = true;
    $("error").hidden = false;
    $("error-title").textContent = "Twofold is unavailable";
    $("error-copy").textContent = "Open the desktop app on this computer, then refresh.";
    $("history").hidden = false;
}

function renderRecord(session) {
    const start = dateMs(session.startedAt);
    const end = dateMs(session.endedAt);
    const total = Math.max(0, end - start);
    const visits = [...session.visits].sort((a, b) => dateMs(a.startedAt) - dateMs(b.startedAt));
    const totals = new Map();
    let cursor = start;
    let gap = 0;
    for (const visit of visits) {
        const from = Math.max(start, dateMs(visit.startedAt));
        const to = Math.min(end, dateMs(visit.endedAt ?? visit.lastSeenAt));
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;
        if (from > cursor) gap += from - cursor;
        const covered = Math.max(0, to - Math.max(cursor, from));
        if (covered > 0) totals.set(hostName(visit), (totals.get(hostName(visit)) ?? 0) + covered);
        cursor = Math.max(cursor, to);
    }
    if (cursor < end) gap += end - cursor;
    if (gap > 0) totals.set("Not recorded", gap);
    const timeline = $("timeline");
    const hosts = $("hosts");
    timeline.replaceChildren();
    hosts.replaceChildren();
    $("legend").replaceChildren();
    $("legend").hidden = true;
    const palette = ["#bd674c", "#cf795a", "#dc9476", "#a96650"];
    let index = 0;
    for (const [name, ms] of totals) {
        const special = name === "Away" ? "away" : name === "Not recorded" ? "unrecorded" : "";
        const color = special ? "#bcb3a7" : palette[index++ % palette.length];
        const segment = document.createElement("span");
        segment.className = `segment ${special}`;
        segment.style.flex = `${ms} 1 0`;
        if (special !== "unrecorded") segment.style.backgroundColor = color;
        segment.title = `${name}: ${formatMinutes(ms)}`;
        timeline.append(segment);
        const row = document.createElement("div");
        row.className = "host-row";
        const label = document.createElement("span");
        label.className = "host-name";
        label.textContent = name;
        const time = document.createElement("span");
        time.className = "host-time";
        time.textContent = formatMinutes(ms);
        row.append(label, time);
        hosts.append(row);
    }
    hosts.hidden = totals.size === 0;
    timeline.hidden = total === 0;
    timeline.setAttribute("aria-label", `Session time by window. ${[...totals].map(([name, ms]) => `${name}: ${formatMinutes(ms)}`).join(". ")}`);
    $("duration").textContent = formatMinutes(total);
    $("record").hidden = false;
    $("reach-row").hidden = true;
    renderVisits(visits);
}

function renderVisits(visits) {
    const list = $("visits");
    list.replaceChildren();
    const sources = {rule: "Automatic rule", memory: "Remembered from your corrections", model: "On-device model", user: "Your correction"};
    for (const visit of visits) {
        const row = document.createElement("li");
        row.className = "visit-row";
        const detail = document.createElement("div");
        detail.className = "visit-description";
        const name = document.createElement("strong");
        name.textContent = hostName(visit);
        const meta = document.createElement("span");
        meta.textContent = formatMinutes(Math.max(0, dateMs(visit.endedAt ?? visit.lastSeenAt) - dateMs(visit.startedAt)));
        detail.append(name, meta);
        if (visit.windowTitle && visit.kind !== "away") {
            const title = document.createElement("span");
            title.className = "visit-title";
            title.textContent = visit.windowTitle;
            detail.append(title);
        }
        row.append(detail);
        if (visit.kind === "attention" && ["serves", "drifts"].includes(visit.shown)) {
            const controls = document.createElement("div");
            controls.className = "visit-controls";
            const button = document.createElement("button");
            const next = visit.shown === "serves" ? "drifts" : "serves";
            button.type = "button";
            button.className = "visit-toggle secondary-action";
            button.textContent = visit.shown === "serves" ? "Served ↔" : "Drift ↔";
            button.setAttribute("aria-label", `${hostName(visit)}: ${button.textContent}. Change to ${next === "serves" ? "Served" : "Drift"}`);
            button.addEventListener("click", () => void mutate("tap", {visitId: visit.id, label: next}, $("review-note")));
            const source = document.createElement("span");
            source.className = "visit-source";
            source.textContent = sources[visit.shownSource ?? visit.verdict?.source] ?? "Source unavailable";
            controls.append(button, source);
            row.append(controls);
        }
        list.append(row);
    }
    if (visits.length === 0) list.textContent = "No windows were recorded in this session.";
}

function render(data) {
    snapshot = data;
    const next = data.running ?? data.latest;
    const sameSession = next?.id === selected?.id;
    selected = next;
    $("state").hidden = true;
    $("error").hidden = true;
    $("session").hidden = !next;
    if (!next) declaring = true;
    $("start-form").hidden = Boolean(data.running) || !declaring;
    $("new-block-toggle").hidden = Boolean(data.running) || !next;
    $("history").hidden = false;
    $("open-app").dataset.route = data.running ? "running" : data.latest ? `review/${data.latest.id}` : "idle";
    clearInterval(clockTimer);
    if (!next) return;
    $("eyebrow").textContent = data.running ? "IN PROGRESS" : "SESSION REVIEW";
    $("intention").readOnly = busy;
    $("intention-edit").hidden = false;
    $("intention").placeholder = "No intention written. You can add one.";
    if (!dirty || !sameSession) {
        dirty = false;
        $("intention").value = next.intention;
        $("intention-actions").hidden = true;
    }
    $("running-clock").hidden = !data.running;
    $("end-session").hidden = !data.running;
    $("record").hidden = Boolean(data.running);
    $("finish").hidden = Boolean(data.running);
    if (data.running) {
        const tick = () => $("clock").textContent = `${Math.max(0, Math.floor((Date.now() - dateMs(next.startedAt)) / minute))} min so far`;
        tick();
        clockTimer = setInterval(tick, 1000);
    } else {
        renderRecord(next);
        document.querySelectorAll("[data-outcome]").forEach((button) => {
            button.disabled = busy;
            button.setAttribute("aria-pressed", String(button.dataset.outcome === next.outcome));
        });
        $("answer-note").textContent = ["yes", "not_yet"].includes(next.outcome) ? "Saved. You can change it at any time." : "You can leave this unanswered.";
    }
}

async function refresh() {
    if (loading || busy || dirty) return false;
    loading = true;
    const reply = await request("summary");
    loading = false;
    if (busy) return false;
    $("state").setAttribute("aria-busy", "false");
    if (reply.error || !Object.hasOwn(reply, "running")) {
        showUnavailable();
        return false;
    }
    render(reply);
    return true;
}

async function mutate(action, values, note) {
    if (busy) return false;
    if (dirty && action !== "updateIntention") {
        note.textContent = "Save or cancel your intention edit first.";
        return false;
    }
    setBusy(true);
    note.textContent = "Saving…";
    const reply = await request(action, values);
    setBusy(false);
    if (!reply.ok) {
        note.textContent = "Could not save. Your change is still here; try again.";
        return false;
    }
    note.textContent = "Saved.";
    await refresh();
    return true;
}

$("intention").addEventListener("input", () => {
    dirty = $("intention").value !== selected?.intention;
    $("intention-actions").hidden = !dirty;
    $("intention-note").textContent = dirty ? "Unsaved change" : "";
});
$("intention-edit").addEventListener("click", () => $("intention").focus());
$("intention-cancel").addEventListener("click", () => {
    $("intention").value = selected.intention;
    dirty = false;
    $("intention-actions").hidden = true;
    $("intention-note").textContent = "Change cancelled.";
});
$("intention-save").addEventListener("click", async () => {
    if (!selected || busy) return;
    const value = $("intention").value;
    const id = selected.id;
    const saved = await mutate("updateIntention", {sessionId: id, intention: value}, $("intention-note"));
    if (!saved) return;
    dirty = false;
    selected.intention = value.trim();
    await refresh();
});
$("intention").addEventListener("keydown", (event) => {
    if (event.key === "Escape") $("intention-cancel").click();
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) $("intention-save").click();
});
document.querySelectorAll("[data-outcome]").forEach((button) => {
    button.addEventListener("click", () => {
        if (selected && !snapshot.running) void mutate("answer", {sessionId: selected.id, outcome: button.dataset.outcome}, $("answer-note"));
    });
});
$("clear-answer").addEventListener("click", () => {
    if (selected && !snapshot.running) void mutate("answer", {sessionId: selected.id, outcome: "unanswered"}, $("answer-note"));
});

async function openDesktop(route) {
    const reply = await request("open", {route});
    if (!reply.ok) showUnavailable();
}
$("history").addEventListener("click", () => void openDesktop("history"));
$("new-block-toggle").addEventListener("click", () => {
    declaring = !declaring;
    $("start-form").hidden = !declaring;
    $("new-block-toggle").textContent = declaring ? "Cancel new block" : "New block";
    if (declaring) $("new-intention").focus();
});
$("privacy").addEventListener("click", () => void openDesktop("privacy"));
$("open-app").addEventListener("click", () => void openDesktop($("open-app").dataset.route || "idle"));
$("refresh").addEventListener("click", () => {
    if (dirty) $("intention-note").textContent = "Save or cancel your edit before refreshing.";
    else void refresh();
});
$("end-session").addEventListener("click", async () => {
    if (busy || dirty) {
        $("intention-note").textContent = "Save or cancel your edit before ending the block.";
        return;
    }
    const reply = await request("end");
    if (!reply.ok) showUnavailable();
    else void refresh();
});

function targetsFrom(id, role) {
    return $(id).value.split(/[,\n]/).map((target) => target.trim().toLowerCase())
        .filter(Boolean)
        .map((target) => ({target, role}));
}
$("start-session").addEventListener("click", async () => {
    if (busy || dirty || starting) return;
    const targets = [...targetsFrom("work-targets", "work"), ...targetsFrom("distraction-targets", "distraction")];
    if (targets.length > 100 || targets.some(({target}) => target.length > 256)) {
        $("start-note").textContent = "Use at most 100 entries, each up to 256 characters.";
        return;
    }
    starting = true;
    setBusy(true);
    $("start-note").textContent = "Starting Twofold…";
    const reply = await request("start", {intention: $("new-intention").value, targets});
    setBusy(false);
    if (!reply.ok) {
        starting = false;
        setBusy(false);
        $("start-note").textContent = "Could not start. Open Twofold to try again.";
        return;
    }
    // The desktop owns capture; a launch acknowledgment is not a started session.
    for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await refresh();
        if (snapshot?.running) {
            starting = false;
            setBusy(false);
            $("start-note").textContent = "";
            return;
        }
    }
    $("start-note").textContent = "The block has not started. Check the desktop app and try again.";
    starting = false;
    setBusy(false);
});
void refresh();
setInterval(() => void refresh(), 3000);
