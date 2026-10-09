const intention = document.getElementById("intention");

chrome.runtime.sendNativeMessage("com.focuslocal.ledger", {type: "status"}, (reply) => {
    const error = chrome.runtime.lastError;
    if (error) {
        console.warn("Ledger session unavailable", error.message);
    }
    const startedAt = typeof reply?.startedAt === "string" ? Date.parse(reply.startedAt) : NaN;
    if (error || !reply || reply.none || typeof reply.intention !== "string" || !Number.isFinite(startedAt)) {
        intention.textContent = "";
        return;
    }
    intention.textContent = reply.intention;
});
