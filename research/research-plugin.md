# Browser Extension & Native Messaging Relay Research

## Verdict
- **Scope: Chrome, Edge, and Brave only.** Skip Firefox (AMO signing barrier; temporary add-ons wipe on restart) and skip Safari (requires Xcode app wrapper, $99/year Apple Developer signing, and macOS already gets Safari URLs via AppleScript in `x-win`).
- **Relay: Node.js stdio host writing directly to `ledger.db` (SQLite WAL mode).** Completely socket-free. Conforms 100% to the "no network socket" rule (zero socket syscalls, zero ports, zero `net` module listeners).
- **Total Effort: 4.0 hours** (extension 1.5h, host 1.0h, cross-platform installer 1.5h).

---

## 1. Native Messaging Architecture
- **Host Manifest Format**:
  ```json
  {
    "name": "com.focuslocal.ledger",
    "description": "Ledger Active Tab Relay",
    "path": "<ABSOLUTE_OR_RELATIVE_PATH_TO_HOST_LAUNCHER>",
    "type": "stdio",
    "allowed_origins": ["chrome-extension://<PINNED_EXTENSION_ID>/"]
  }
  ```
  *(Firefox uses `"allowed_extensions": ["ledger@focuslocal.internal"]`).*
- **Registration Locations**:
  - **Windows (HKCU Registry)**:
    - Chrome: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.focuslocal.ledger`
    - Edge: `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.focuslocal.ledger`
    *(Default value = full path to host manifest JSON; no admin elevation required).*
  - **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.focuslocal.ledger.json`
  - **Linux**: `~/.config/google-chrome/NativeMessagingHosts/com.focuslocal.ledger.json` (and `~/.config/chromium/...`).
- **Protocol**: 4-byte unsigned integer (native 32-bit LE) length header followed by UTF-8 JSON payload over `stdin`/`stdout`.
- **Extension ID Pinning**: An unpacked extension changes ID unless pinned. In `manifest.json`, specify `"key": "<base64-der-rsa-pubkey>"`. The extension ID is deterministically derived from the public key SHA-256 hash across all developer/judge machines.
- **Relay Mechanism**:
  - *Honest Note on Sockets*: Unix Domain Sockets (`AF_UNIX`) literally use socket syscalls (`socket()`). Windows Named Pipes use filesystem drivers (`NPFS`) but Node wraps both in `net.Server`. To strictly honor "no network socket", avoid `net`.
  - *Recommended Relay*: The host script (executed by `node`) reads framed stdio messages and writes tab updates directly into `ledger.db` (`node:sqlite`, `PRAGMA journal_mode = WAL`). SQLite handles multi-process concurrency cleanly. The Electron capture loop polls `ledger.db` on its existing 1s cycle.

---

## 2. Manifest V3 & Browser APIs
- **Permissions**: `"tabs"` and `"nativeMessaging"` are **mandatory**. `"activeTab"` does **not** work: it only grants access on explicit user interaction (click/shortcut), leaving `tab.url` and `tab.title` empty during background events.
- **Listeners**:
  - `chrome.windows.onFocusChanged`: Detects browser focus gain/loss.
  - `chrome.tabs.onActivated`: Captures tab switches.
  - `chrome.tabs.onUpdated`: Filtered by `{ properties: ["url", "title", "status"] }` (only report when status is `"complete"`).
- **Service Worker Lifecycle**: Chrome 105+ keeps the service worker alive while `runtime.connectNative()` maintains an open port. If disconnected, handle `port.onDisconnect` with backoff reconnect.
- **Incognito**: Disabled by default. User must toggle "Allow in Incognito" in `chrome://extensions`. Manifest uses `"incognito": "spanning"`.

---

## 3. Firefox & Safari Evaluation
- **Firefox**: WebExtensions JS is compatible, but release Firefox strictly enforces AMO signatures (`xpinstall.signatures.required` cannot be overridden). Unsigned add-ons load only as "Temporary Add-ons" via `about:debugging` and are deleted upon browser restart. Skip for hackathon.
- **Safari**: Requires an Xcode wrapper project, native App Extension (`NSExtensionContext`), App Groups, and Developer Program signing ($99/year). Skip; native macOS capture already extracts Safari/Chrome URLs via AppleScript.

---

## 4. Failure Modes & Mitigations
1. **Extension not installed**: Electron falls back to window title regex matching (zero crash).
2. **Host not registered**: Extension catches `runtime.lastError` on connect and logs degraded state.
3. **Browser not focused**: Host clears active state when `onFocusChanged` reports blur; Electron relies on OS foreground window.
4. **Multiple windows/profiles**: `onFocusChanged` tracks `windowId`; only the active window's tab is sent.
5. **Incognito**: Without explicit user toggle, incognito tabs emit no events (safe privacy default).

---

## 5. Judge Installation Steps
- **Windows**: Run `powershell ./scripts/install-host.ps1` (registers HKCU keys).
- **Linux/macOS**: Run `./scripts/install-host.sh` (links JSON to user config directory).
- **Browser**: Open `chrome://extensions` -> Developer Mode -> "Load unpacked" -> select `extension/`.