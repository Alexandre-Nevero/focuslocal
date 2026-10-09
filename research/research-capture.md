# Capture research: frontmost app, title, URL, idle (Windows and macOS)

## Verdict
- **Windows only: about 3–4 h** for a TypeScript dev using Electron and `@miniben90/x-win`. There are no permission prompts. You get app, title and URL for Chrome, Edge and Firefox. Idle comes from Electron's built-in `powerMonitor`.
- **macOS adds about 6–8 h**, almost all of it permission flow and testing on the M4. Screen Recording is needed for titles. A separate Automation prompt appears for each browser before its URL can be read. Firefox URLs are not supported.
- **Recommendation:** use one Electron capture module on `@miniben90/x-win`, because the same TypeScript runs on both OSes. Make Windows the demo target. Ship macOS only if the Mac teammate owns its permission screen. Avoid Tauri: Bennett would first need Rust and the MSVC Build Tools ([Tauri prereqs](https://v2.tauri.app/start/prerequisites/)).

## Verdict table
| OS | Signal | API | Permission | Library | Effort |
|---|---|---|---|---|---|
| Win | App | `GetForegroundWindow` + `QueryFullProcessImageNameW` | none | x-win, get-windows | 0.5 h |
| Win | Title | `GetWindowTextW` | none | x-win, get-windows | (included above) |
| Win | URL | UI Automation reading the address bar | none; elevated windows need `uiAccess` | **x-win only**: Chrome, Edge, Firefox, Opera, Chromium. No Arc | 1–2 h |
| Win | Idle | `GetLastInputInfo` | none | Electron `powerMonitor.getSystemIdleTime()` | 0.5 h |
| mac | App | `NSWorkspace.frontmostApplication` | none | both | 0.5 h |
| mac | Title | `CGWindowListCopyWindowInfo` → `kCGWindowName` | **Screen Recording** | both; title is `""` without it | 2 h (prompt UI) |
| mac | URL | AppleScript `tell app id … get URL of active tab of front window` (Safari: `front document`) | **Automation, per browser**, plus `NSAppleEventsUsageDescription` in Info.plist | both: Safari, Chrome, Edge, Brave, Opera. No Firefox, no Arc | 2–3 h (+1 h for Arc by hand) |
| mac | Idle | `CGEventSourceSecondsSinceLastEventType` | none [INFERENCE] | `powerMonitor` | 0.5 h |

Sources:
- Win32 docs: [GetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow), [GetWindowTextW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextw), [GetLastInputInfo](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getlastinputinfo), [UIA security](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-securityoverview)
- Apple docs: [frontmostApplication](https://developer.apple.com/documentation/appkit/nsworkspace/frontmostapplication), [secondsSinceLastEventType](https://developer.apple.com/documentation/coregraphics/cgeventsource/secondssincelasteventtype(_:eventtype:)), [NSAppleEventsUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappleeventsusagedescription)
- Electron [powerMonitor](https://www.electronjs.org/docs/latest/api/power-monitor). In Chromium it wraps `GetLastInputInfo` ([idle_win.cc](https://raw.githubusercontent.com/chromium/chromium/main/ui/base/idle/idle_win.cc)) and `CGEventSourceSecondsSinceLastEventType` ([idle_mac.mm](https://raw.githubusercontent.com/chromium/chromium/main/ui/base/idle/idle_mac.mm)).

## Libraries (checked 2026-10-09)
**`get-windows` 9.3.0** ([npm](https://registry.npmjs.org/get-windows/latest), [README](https://github.com/sindresorhus/get-windows))
- **Fields:** returns `title` and `owner{name,path,bundleId(mac)}`. **`url` is macOS-only.**
- **Windows build:** an N-API 9 addon. node-pre-gyp downloads a prebuilt x64 binary from GitHub at **install** time; there is no network call at runtime ([release](https://api.github.com/repos/sindresorhus/get-windows/releases/latest)). If the binary is missing, it silently returns `undefined` ([windows.js](https://raw.githubusercontent.com/sindresorhus/get-windows/main/lib/windows.js)).
- **macOS:** it **starts a bundled Swift helper process on every call** ([macos.js](https://raw.githubusercontent.com/sindresorhus/get-windows/main/lib/macos.js)).
- **Default macOS failure:** the helper exits with code 1 when Accessibility or Screen Recording is missing ([main.swift](https://raw.githubusercontent.com/sindresorhus/get-windows/main/Sources/GetWindowsCLI/main.swift)). Pass `{accessibilityPermission:false, screenRecordingPermission:false}` to degrade gracefully instead.
- **Electron:** only sandboxed (Mac App Store) builds need extra entitlements.

**`@miniben90/x-win` 3.7.0 (npm) / `x-win` 5.8.0 (crate)** ([npm](https://registry.npmjs.org/@miniben90/x-win/latest), [README](https://github.com/miniben-90/x-win), [docs.rs](https://docs.rs/crate/x-win/latest))
- **Build:** napi-rs with prebuilt optional packages for win32 x64/arm64 and darwin arm64/universal, so **no Rust is needed** to use it from Node.
- **Fields:** `title`, `info{name,path,execName}`, and a lazy `url` getter.
- **Windows URL:** read through UI Automation, including **Firefox** (`urlbar-input`) ([api.rs](https://raw.githubusercontent.com/miniben-90/x-win/main/x-win-rs/src/win32/api.rs)).
- **macOS URL:** runs `osascript` ([macos/api.rs](https://raw.githubusercontent.com/miniben-90/x-win/main/x-win-rs/src/macos/api.rs)). Firefox support is commented out.
- **Subscribe:** `subscribeActiveWindow(cb, interval=100ms)`.
- **Electron:** the README advises calling it from a worker thread on macOS and adding the native packages to `asar.unpack`.

**`active-win-pos-rs` 0.11.0** ([Cargo.toml](https://raw.githubusercontent.com/dimusic/active-win-pos-rs/main/Cargo.toml)): gives title, app name and position only. **It has no URL.** Title is empty without Screen Recording.

## Polling vs hooks
- **Windows hook:** `SetWinEventHook` needs **a message loop on the thread that registers it** ([doc](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwineventhook)), so it requires native code. `EVENT_SYSTEM_FOREGROUND` does not fire on a tab or title change inside the same window [INFERENCE].
- **macOS notification:** `didActivateApplicationNotification` fires only on app-level changes ([doc](https://developer.apple.com/documentation/appkit/nsworkspace/didactivateapplicationnotification)).
- **Recommendation:** **poll every 1 s.** Read the URL only when app or title changes, because UIA and `osascript` are the expensive part. get-windows on macOS means one process start per poll.

## Edge cases
- **UWP / ApplicationFrameHost:** both libraries walk the child windows to find the real exe (get-windows `main.cc:161`, x-win `api.rs:483`). If no child is found, the owner stays ApplicationFrameHost [INFERENCE].
- **Elevated window:**
  - The title still reads, because `GetWindowText` reads another process's caption directly (doc).
  - The URL fails: a medium-IL process cannot reach elevated UI through UIA without signed `uiAccess` (doc).
  - get-windows returns `null` if `OpenProcess` fails (`main.cc:153`).
- **Activation in transition:** `GetForegroundWindow` can return NULL while a window is losing activation (doc). Treat that poll as "no change".
- **Lock screen:** use `powerMonitor` `lock-screen`/`unlock-screen` and `getSystemIdleState()==='locked'` (Electron doc). On Windows the foreground app becomes LockApp [INFERENCE].
- **Sleep:** the poll timer stops. Use `suspend`/`resume` to record a gap.
- **Idle edge cases:** `GetLastInputInfo` is per-session and not monotonic (doc). Chromium handles the 49.7-day tick wrap.
- **Multiple monitors:**
  - Windows has a single foreground window.
  - On macOS, get-windows takes the frontmost app's first on-screen window in z-order (`main.swift`). That may be a palette window rather than the key window [INFERENCE].
- **Fullscreen games:** get-windows 9.3.0 "include fullscreen apps" (#205). Exclusive fullscreen returns the game window [INFERENCE].
- **Private/incognito:**
  - Windows: UIA reads the address bar the same way [INFERENCE].
  - macOS Chrome incognito and Safari private via AppleScript: **unverified**.
- **No Screen Recording on macOS:** title is `""` (all three READMEs).
- **Automation denied on macOS:** `errAEEventNotPermitted` (-1743) ([doc](https://developer.apple.com/documentation/coreservices/erraeeventnotpermitted)). x-win returns `url:""` and get-windows omits `url`.
- **Firefox URL:** none on macOS in either library. Works on Windows via x-win.
- **Arc:**
  - Not in either library's browser list.
  - Its macOS AppleScript exposes tab `url` ([arc-applescript-api](https://github.com/kkoscielniak/arc-applescript-api)).
  - Arc is in maintenance mode ([Verge](https://www.theverge.com/news/674603/arc-browser-development-stopped-dia-browser-company)).
- **Address-bar text while typing:** UIA returns the typed text, and the scheme may be elided [INFERENCE].
- **macOS 15 re-prompts:** Sequoia asks again for Screen Recording periodically ([MacRumors](https://www.macrumors.com/2024/08/15/macos-sequoia-screen-recording-app-permissions), secondary source). An Apple forum thread reports CGWindowList permission behavior changing in macOS 27 beta ([thread 839069](https://developer.apple.com/forums/thread/839069), blocked by verification, **unread**).
- **Dev runs:** macOS grants permission to the responsible process, which is Terminal or VS Code during `npm start`, not the app [INFERENCE; cf. [cmux #3449](https://github.com/manaflow-ai/cmux/issues/3449)].

## Unverified
The items marked [INFERENCE] above, plus macOS 26.5 behavior and Arc on Windows (no library support; would need a custom UIA lookup).