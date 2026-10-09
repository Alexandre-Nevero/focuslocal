# Desktop shell for Ledger: research (2026-10-09)

## Verdict
- **Use Electron** (the current stable is 44.7.0, which bundles Node 24.21) with **`node:sqlite`**, **`get-windows`** and **`node-llama-cpp`**. Bennett already has everything it needs. Tauri needs Rust plus the MSVC Build Tools, and the native option means writing the app twice.
- **Ship one OS: Windows.** Run the same code on macOS from source only as a stretch, capped at about 4 hours.
  - Windows is Bennett's machine. Reading the foreground window title needs no OS permission there, and there is no Gatekeeper.
  - Windows 10 has no on-device model built in, so you have to ship llama.cpp. `node-llama-cpp` uses Metal on the M4, so the same code would also run the model on macOS.
- **Both OSes in 14 hours: high risk.** It costs about **+4–6 hours** for macOS on top of the Windows build [INFERENCE]. That pays for permission prompts, the Info.plist usage text, a Swift helper if you use Apple's model, packaging or the quarantine workaround, and testing on the only Mac. Doing both natively costs about **+8–12 hours** for the second codebase [INFERENCE], which doesn't fit.
- **If the team would rather demo on the M4:** stay on Electron and let the Mac teammate drive. Expect about +3–4 hours [INFERENCE] for permissions and a Swift helper that calls `SystemLanguageModel`. Bennett can't run or test that build on his machine.

## Top 5 failure modes that eat the time
1. **macOS privacy permissions (TCC).**
   - `get-windows` returns an empty title without the Screen Recording permission. It needs Accessibility to read the URL, and its helper calls `exit(1)` when Accessibility isn't granted. ([README](https://github.com/sindresorhus/get-windows), [main.swift](https://raw.githubusercontent.com/sindresorhus/get-windows/main/Sources/GetWindowsCLI/main.swift))
   - macOS charges the permission to whichever process is "responsible" for the app. When you start the app from a terminal, that's iTerm or VS Code's Electron, not your app. Launch through Finder or `open` and the grant goes to the app itself. ([Qt TCC write-up](https://www.qt.io/blog/the-curious-case-of-the-responsible-process))
   - So `npm start` and the packaged Ledger.app each ask for permission separately. I'm inferring that ad-hoc-signed rebuilds ask again each time; Apple's forum page was blocked, so this is **unverified**.
2. **Native modules built for the wrong Node version.**
   - Electron needs native modules rebuilt for its own ABI, and node-gyp source builds on Windows need MSVC. ([Electron docs](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules))
   - Avoid `better-sqlite3`. `node:sqlite` has worked in Electron since v38 ([PR #47757](https://releases.electronjs.org/pr/47757)) and is a release candidate in Node 24.15+ ([Node docs](https://nodejs.org/api/sqlite.html)).
   - `get-windows` downloads a prebuilt N-API binary and only builds from source if that fails ([package.json](https://raw.githubusercontent.com/sindresorhus/get-windows/main/package.json)).
   - `node-llama-cpp` won't build from source inside Electron. It must not be bundled by Vite, and its binaries must stay outside the asar archive ([guide](https://node-llama-cpp.withcat.ai/guide/electron)).
3. **The model runtime.**
   - Phi Silica, Windows' built-in model, needs Windows 11 25H2, so it's not available on Windows 10 19045 ([MS Learn](https://learn.microsoft.com/en-us/windows/ai/apis/troubleshooting)).
   - Windows therefore needs a GGUF model file. That conflicts with the PRD's "no model download" friction budget, so Bennett has to make that call.
   - Apple's Foundation Models is a Swift API. The 2026 framework also has `PrivateCloudComputeLanguageModel`, so code must use `SystemLanguageModel` only to keep the no-cloud rule ([Apple](https://developer.apple.com/documentation/foundationmodels)).
4. **Distributing a Mac binary.**
   - macOS code signing only works on a Mac ([electron-builder](https://www.electron.build/v26/docs/features/multi-platform-build/)).
   - Apple silicon refuses to run unsigned executables; an ad-hoc signature is enough ([Apple](https://developer.apple.com/documentation/macos-release-notes/macos-big-sur-11_0_1-universal-apps-release-notes)).
   - electron-builder doesn't ad-hoc sign by default. An ad-hoc signature also needs the `disable-library-validation` entitlement ([docs](https://www.electron.build/v26/docs/features/code-signing/code-signing-mac)).
   - Since Sequoia, Control-click no longer overrides Gatekeeper. Users must click Open Anyway in System Settings ([Apple](https://developer.apple.com/news/?id=saqachfa), [support](https://support.apple.com/en-us/102445)). `xattr -dr com.apple.quarantine` is the CLI workaround [from practice, not cited].
5. **The Windows URL gap, and CI debugging.**
   - `get-windows` only returns the browser URL on macOS ([README](https://github.com/sindresorhus/get-windows)). On Windows, site rules can only match the window title unless you write a UI Automation helper (about 2–3 h [INFERENCE]).
   - Debugging a GitHub Actions macOS + Windows matrix on deadline burns time with nothing to show for it.

## Comparison
| | Electron | Tauri v2 | Native per OS |
|---|---|---|---|
| Setup on Bennett's machine | `npm i` only | rustup, plus MSVC "Desktop development with C++", plus WebView2 ([prereqs](https://v2.tauri.app/start/prerequisites/)): roughly 1–2 h of installs, plus Rust ramp-up [INFERENCE] | dotnet for Windows; Swift needs a Mac |
| Tray and popover | `Tray`, whose `click` event gives the icon bounds, plus a positioned `BrowserWindow` ([docs](https://www.electronjs.org/docs/latest/api/tray)) | `tray-icon` feature ([docs](https://v2.tauri.app/learn/system-tray/)) | `MenuBarExtra` with `.window` style, macOS 13+ ([Apple](https://developer.apple.com/documentation/swiftui/menubarextra)) |
| SQLite | `node:sqlite`, built in | sql plugin, Rust ≥1.90 ([docs](https://v2.tauri.app/plugin/sql/)) | per OS |
| Foreground window | `get-windows`, ready to use | needs a Rust crate or sidecar [unverified] | per OS |
| LLM | `node-llama-cpp` on both OSes; Swift helper for the Apple model | Rust bindings or a sidecar | direct calls |
| Cost of the second OS | test and fix only | test and fix only | write it again |

**Avoid passing a tray `guid` on Windows.** For an unsigned exe the GUID is tied to the exe's path, so a moved exe breaks the tray icon ([Electron Tray](https://www.electronjs.org/docs/latest/api/tray)).

## Cross-compiling and CI
- A Windows machine can't produce a usable macOS build: signing needs a Mac ([electron-builder](https://www.electron.build/v26/docs/features/multi-platform-build/), [Tauri](https://v2.tauri.app/distribute/sign/macos/)). `node-llama-cpp` doesn't support cross-packaging between OSes either ([guide](https://node-llama-cpp.withcat.ai/guide/electron)).
- Your options are the Mac teammate's machine, or the GitHub-hosted runners: `macos-latest` is macOS 26 arm64 and `windows-latest` is Server 2025 ([runner-images](https://github.com/actions/runner-images)).
- A CI matrix works ([Tauri example](https://v2.tauri.app/distribute/pipelines/github/)), but its output is still unsigned. Skip it at a hackathon.

## Signing consequences for an unsigned build
- **Windows:** SmartScreen shows "Windows protected your PC" and the user clicks "Run anyway". Smart App Control on Windows 11 may block the exe outright ([MS Learn](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)).
- **macOS:** Gatekeeper says "cannot verify" or "damaged". The fix is Open Anyway in System Settings, or `xattr` (see failure mode 4).

## How judges run it
1. **From source (main path):** `npm install && npm start`. This needs Node on the judge's machine.
   - Install fetches Electron, the `get-windows` prebuilt and the `node-llama-cpp` binaries. That's install-time network only, not the app making network calls.
   - Add a separate script that fetches the GGUF model, and never call node-llama-cpp's `pull` command from the app.
   - On macOS, the permission prompts will name Terminal, so the README must say so.
2. **Fallback:** an unsigned zip on GitHub Releases, with SmartScreen and Gatekeeper steps in the README.

## Unverified
- Install-time and hour estimates.
- Whether ad-hoc-signed rebuilds trigger new permission prompts.
- Rust crates for reading the foreground window.
- Whether Electron's default Info.plist includes `NSAppleEventsUsageDescription`, which the URL lookup's AppleScript needs.