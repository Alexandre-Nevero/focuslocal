# ADR-004 — Three OSes, one main process, three frontends

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owners:** Bennett
- **Related:** BR-001, BR-005, idea.md §10, system-design.md §4, ADR-003, research/ledger-stack:research/research-capture.md, research/ledger-stack:research/research-linux.md, research/ledger-stack:research/research-plugin.md, research/ledger-stack:research/research-widget.md

### Context

The architecture sketch has four boxes: Desktop App, Widget, Browser Plugin, and Local Backend. All three team OSes (Windows 10, macOS M4, Linux Mint XFCE X11) are equal tier. Capture differs per OS: the active URL is readable through UI Automation on Windows and AppleScript on macOS, but not on Linux. Nothing may open a network client on the review path.

### Why now

Capture, the plugin, and widgets are split across three people (Bennett, Alexandrei, Alex). The boundaries have to be fixed before they branch.

### Options considered

1. **Local Backend as a localhost HTTP API** that the app, widget, and plugin all call. Pros: one interface for every client. Cons: it is a network client and listener, against BR-005; it adds a port and a server process.
2. **Local Backend as the Electron main process; the plugin reaches it through a native-messaging host that writes the same SQLite file.** Pros: no socket; stdio only; one file is the source of truth. Cons: the host must be registered per browser and per OS.
3. **No plugin; URL from OS capture only.** Pros: least code. Cons: Linux gets no URL at all.

### Decision

Use option 2.

- **Desktop App** is the review/ledger window. **Local Backend** is the Electron main process, talking to the renderer over IPC. No search index; no story needs one.
- **Capture:** `@miniben90/x-win` polled every 1 s; idle from Electron `powerMonitor`. URL from x-win on Windows (UIA, including Firefox) and macOS (AppleScript, no Firefox). On Linux the URL comes only from the plugin, otherwise it stays empty.
- **Browser plugin:** Chrome/Edge/Brave MV3 only. Its native-messaging host speaks stdio and writes the active tab into the local SQLite file (WAL). Firefox and Safari are out.
- **Popup:** shows the intention and the clock only. It is a running view under BR-001, not a product surface. idea.md §10 already allows a later helper that only supplies the active URL; the plugin is that helper plus this view.
- **Widgets:** every OS gets a tray icon (Linux: a context menu) and a floating mini window. The desktop layer is a display-only macOS `type:'desktop'` window and an xfce4-genmon panel item on Linux. Windows 10 gets the mini window only. WidgetKit is out: App Groups need a Team ID.
- **Distribution:** Windows and Linux run from source. macOS ships as an ad-hoc-signed `Ledger.app` built on Alexandrei's Mac, where the pitch runs.
- **Unsupported:** Wayland sessions (x-win needs GNOME there), Intel Macs, ARM Windows/Linux (prebuilt binaries unverified), and 32-bit systems.

### Why this option

Option 1 breaks the no-network rule for convenience. Option 3 leaves one equal-tier OS without URLs. Option 2 keeps every write local and every channel a pipe or a file.

### Overrides

- **Prior ADRs:** none.
- **Doc or plan truth:** none of BR-001..BR-006. Fills system-design.md §4/§5 rows for capture, plugin, and widgets.
- **Out of scope:** runtime (ADR-003) and model stage (ADR-005).

### Consequences

- **Easier:** one SQLite file is the only shared state; the native host owns nothing.
- **Harder or owed:** an install script must register the host for Chrome, Edge, and Brave on each OS; Linux URL depends on the plugin being installed.
- **Contingency, pre-decided:** if `@miniben90/x-win` fails to install or load on an OS, switch that OS to `get-windows@9.3` with `{accessibilityPermission: false, screenRecordingPermission: false}` (Linux needs `x11-utils`) and record the switch here.
