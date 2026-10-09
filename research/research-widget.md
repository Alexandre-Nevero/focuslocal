### Verdict Table

| OS | Recommended Widget Mechanism | Status | Estimate |
| :--- | :--- | :--- | :--- |
| **macOS** (26.5 M4) | Frameless transparent Electron HUD (`alwaysOnTop: 'floating'`) | **Works** (Native WidgetKit **Blocked**) | 2–3 h |
| **Windows 10** (19045) | Frameless non-focusable Electron HUD with minimize intercept | **Degraded** (Native Widget **Blocked**) | 2–3 h |
| **Linux Mint** (XFCE) | File-based sync to `xfce4-genmon-plugin` (or Conky) | **Works** (Electron `type:'desktop'` **Degraded**) | 1–2 h |

---

### 1. macOS WidgetKit: Achievable Tonight with Ad-Hoc Signing?
**Verdict: NO.** Real WidgetKit is **BLOCKED** tonight.
* **App Group Blockers**: App Group shared containers (`com.apple.security.application-groups`) require an official Apple Developer Team ID and a provisioning profile ([Apple TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles)). Ad-hoc signing (`codesign -s -`) has no Team ID; macOS sandboxing and container management reject ad-hoc app group access.
* **Chronod / PlugInKit**: macOS's widget daemon (`chronod`) strictly refuses to register ad-hoc signed `.appex` bundles outside an active Xcode development session.
* **Tooling & Time**: Electron has no native `.appex` bundling tools. Compiling a Swift widget extension, manual inside-out code-signing, and debug cycles exceed the 12.5-hour freeze (estimate: 8–16+ hours with fatal signing blockers).
* *(Note: WidgetKit itself supports live timers via `Text(date, style: .timer)` which renders GPU-side without consuming timeline budget, but cannot be shipped ad-hoc).*

### 2. Electron-Native Desktop Windows across All 3 OSes
* **macOS**: `type: 'desktop'` sets `kCGDesktopWindowLevel - 1` ([Electron BaseWindow Docs](https://electronjs.org/docs/latest/api/structures/base-window-options)), which drops the window behind Finder wallpaper and receives zero input/focus. Furthermore, "Show Desktop" slides standard windows away. **Recommendation**: Use a frameless, non-focusable floating window (`focusable: false`, `skipTaskbar: true`, `setVisibleOnAllWorkspaces(true)`, `setAlwaysOnTop(true, 'floating')`).
* **Windows 10**: Windows has no desktop window type. Reparenting to `WorkerW` is a brittle Win32 hack. A standard bottom-most window is minimized by `Win + D` ("Show Desktop"); intercepting `win.on('minimize')` to restore causes visible flickering.
* **Linux (X11)**: `type: 'desktop'` sets `_NET_WM_WINDOW_TYPE_DESKTOP`. Under `xfwm4`, it stays at the root level and ignores focus, but frequently conflicts with `xfdesktop` (desktop icons/wallpaper manager).

### 3. Windows 10 OS Widget Surface
**Verdict: NONE.**
* Windows 11 Widgets Board requires Windows 11 22H2+ and packaged WinAppSDK apps ([Microsoft Widget Providers](https://learn.microsoft.com/en-us/windows/apps/develop/widgets/widget-providers)).
* Windows 10 has no public desktop widget API (Desktop Gadgets removed in Win 8; News & Interests is closed to 3rd-party code).

### 4. Linux Mint XFCE (xfce4-genmon-plugin / Conky)
**Verdict: Highly Feasible (1–1.5 h).**
* **xfce4-genmon-plugin**: The Electron app writes session state (`{"intention":"...", "startedAt":...}`) to `~/.config/ledger/session.json`. A 3-line shell script run by `genmon` formats this into `<txt>Intention | 12:34</txt>` every second ([XFCE Genmon Docs](https://docs.xfce.org/panel-plugins/xfce4-genmon-plugin/start)).
* **Conky**: Reads the file via `${cat /path/to/file}` directly onto the root desktop window.

### Critical Files for Implementation
- `src/main/widget-window.ts` — Creates the cross-platform frameless, non-focusable HUD BrowserWindow.
- `src/main/session-file-sync.ts` — Dumps intention and elapsed time to local file for XFCE genmon/Conky without network sockets.
- `src/renderer/WidgetApp.tsx` — Minimal UI showing session intention and real-time clock.