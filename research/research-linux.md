# Linux Mint XFCE (X11) Compatibility Research: Ledger Stack

## Verdict
**Extra effort: +1.0 to 1.5 hours** on top of a working Windows Electron build.
Linux X11 is significantly lower friction than macOS (+4–6 h) because there are no TCC permission prompts, no Screen Recording dialogs, and no Gatekeeper/code-signing barriers. Only three minor adaptations are needed:
1. Fall back browser URL site rules to window title matching (~15 min).
2. Fall back Tray popover to a context menu opening a standard window (~30 min).
3. Track idle via `getSystemIdleTime()` threshold instead of unsupported `lock-screen` events (~15 min).

## Signal Compatibility Table
| Signal | Status | API / Mechanism | Permissions & Deps | Citation |
|---|---|---|---|---|
| **App Name & Exe** | **Works** | `x-win` X11 via `_NET_WM_PID` + `/proc/[pid]/exe` | None; runtime needs `libxcb.so.1` (preinstalled) | [`x11_api.rs`](https://docs.rs/crate/x-win/latest/source/src/linux/api/x11_api.rs) |
| **Window Title** | **Works** | `x-win` X11 via `_NET_WM_NAME` / `WM_NAME` | None | [`x11_api.rs`](https://docs.rs/crate/x-win/latest/source/src/linux/api/x11_api.rs) |
| **Browser URL** | **Broken** (Fallback) | None available in npm libs (AT-SPI requires custom daemon) | Fallback: match domain rules against window title | [`common_api.rs`](https://docs.rs/crate/x-win/latest/source/src/linux/api/common_api.rs) |
| **System Idle** | **Degraded** | `powerMonitor.getSystemIdleTime()` works (XScreenSaver); `lock-screen` event broken | Needs `libxss1`; rely on idle threshold > X sec | [Electron `powerMonitor`](https://www.electronjs.org/docs/latest/api/power-monitor), [Chromium `idle_linux.cc`](https://raw.githubusercontent.com/chromium/chromium/main/ui/base/idle/idle_linux.cc) |
| **Tray / Popover** | **Degraded** | `StatusNotifierItem` works; `getBounds()` and `click` popup coords broken | Fallback: `tray.setContextMenu()` with "Open Ledger" | [Electron `Tray`](https://www.electronjs.org/docs/latest/api/tray) |
| **Model Runtime** | **Works** | `node-llama-cpp` 3.22.x prebuilt CPU & Vulkan (`gpu:"auto"`) | `mesa-vulkan-drivers` for Vulkan; CPU works out-of-the-box | [node-llama-cpp Vulkan](https://node-llama-cpp.withcat.ai/guide/Vulkan) |

---

## Detailed Findings

### 1. `@miniben90/x-win` on Linux-x64
- **Prebuilt:** npm provides `@miniben90/x-win-linux-x64-gnu` (v3.7.0). No Rust toolchain or build step is needed.
- **Fields under X11:** Returns `id` (XID), `title` (`_NET_WM_NAME`/`WM_NAME`), `info.name` (`WM_CLASS`), `info.process_id` (`_NET_WM_PID`), `info.path` & `info.exec_name` (`/proc/[pid]/exe`), `position` (geometry), and `usage.memory` (`/proc/[pid]/statm`).
- **Dependencies:** Dynamically links against `libxcb.so.1` (`libxcb1` on Mint). It queries XCB directly and does **not** invoke `xprop` or `xwininfo`.
- **Wayland:** Inspects `WAYLAND_DISPLAY`. If Wayland is active, it requires GNOME Shell and the companion extension `x-win@miniben90.org` over D-Bus; on non-GNOME Wayland it fails. On Mint XFCE (pure X11 under LightDM), it routes to `X11Api` cleanly.

### 2. `get-windows` on Linux
- **CLI Binaries:** `lib/linux.js` executes `xprop` and `xwininfo` child processes (3 child process spawns per poll). It requires `x11-utils` (`sudo apt install x11-utils`).
- **Fields:** Returns `title`, `id`, `owner{name, processId, path}`, `bounds`, and `memoryUsage`.
- **URL:** macOS-only in `get-windows`. Linux has no URL property.

### 3. Browser URL on Linux X11
- No maintained npm capture library implements browser URL recovery on Linux. In `x-win`, `get_browser_url()` explicitly returns `"URL recovery not supported on Linux distribution!"`.
- **Mitigation:** URL must be treated as `null`/`""`. Domain matching rules must fall back to regex matching against the window title (e.g. `GitHub - ...`, `YouTube - ...`).

### 4. Electron `powerMonitor` & Lock Events
- `getSystemIdleTime()`: Supported on Linux X11 via XScreenSaver extension (`libxss1`).
- `lock-screen` & `unlock-screen`: Electron docs explicitly mark these as `*macOS* *Windows*`. They do not emit on Linux. The app must detect inactive periods solely using idle time thresholds.

### 5. Electron `Tray` on XFCE
- XFCE panel handles tray icons via StatusNotifierItem (SNI).
- `tray.getBounds()`, `popUpContextMenu()`, and right/double-click events are documented as `*macOS* *Windows*` only. `tray.getBounds()` returns dummy `{x:0, y:0, width:0, height:0}`.
- Pinned popovers cannot compute screen position.
- **Recommended Fallback:** Call `tray.setContextMenu()` with an "Open Ledger" entry that shows or focuses a standard centered `BrowserWindow`.

### 6. `node-llama-cpp` Binaries
- Prebuilt packages exist: `@node-llama-cpp/linux-x64` (CPU), `@node-llama-cpp/linux-x64-vulkan`, and `@node-llama-cpp/linux-x64-cuda`.
- **glibc:** Linux Mint 22 (Ubuntu 24.04 base) provides glibc 2.39, exceeding the prebuilts' glibc 2.31/2.35 target.
- **Vulkan:** Requires `mesa-vulkan-drivers` and `libvulkan1` for Intel/AMD Mesa Vulkan. If Vulkan fails, `gpu:"auto"` drops back to CPU seamlessly.

### 7. `node:sqlite` in Electron 44
- Fully functional. Built into Node.js 24 embedded in Electron 44, statically compiled across all OSes.

### 8. Running from Source on Mint
- **Node version:** Host environment needs Node `>=20.0.0` for npm execution.
- **Apt packages:** Prebuilts handle all modules (`build-essential` not required unless building from source). For runtime, ensure `libxss1` (idle monitor) and `mesa-vulkan-drivers` (GPU).