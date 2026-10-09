const intention = document.getElementById("intention");
const clock = document.getElementById("clock");

chrome.runtime.sendNativeMessage("com.focuslocal.ledger", {type: "status"}, (reply) => {
    const error = chrome.runtime.lastError;
    if (error) {
        console.warn("Ledger session unavailable", error.message);
    }
    const startedAt = typeof reply?.startedAt === "string" ? Date.parse(reply.startedAt) : NaN;
    if (error || !reply || reply.none || typeof reply.intention !== "string" || !Number.isFinite(startedAt)) {
        intention.textContent = "No session";
        clock.textContent = "";
        return;
    }
    intention.textContent = reply.intention;
    const renderClock = () => {
        clock.textContent = `${Math.max(0, Math.floor((Date.now() - startedAt) / 60000))}m`;
    };
    renderClock();
    setInterval(renderClock, 60000);
});
