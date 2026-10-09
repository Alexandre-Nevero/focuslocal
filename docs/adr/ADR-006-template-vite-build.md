# ADR-006 — Build with the template's Vite setup, not electron-vite

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owners:** Bennett
- **Related:** ADR-003, system-design.md §9 (module map, no network)

### Context

ADR-003 option 4 names "React via electron-vite" and also says to scaffold from `npm create node-llama-cpp@latest -- --template electron-typescript-react`. Generating that template on 2026-10-09 showed it does not use electron-vite. It uses Vite with `vite-plugin-electron`: main and preload live in `electron/`, the renderer in `src/`, and the builds go to `dist-electron/` and `dist/`. It pins Electron 40. The two halves of ADR-003's decision cannot both hold.

### Why now

The scaffold is the first commit both teammates build on. Every path in their issues depends on this choice.

### Options considered

1. **Keep the template's Vite + `vite-plugin-electron` layout, bump Electron to 44.** Pros: it is the layout node-llama-cpp ships and tests, including the electron-builder rules that keep llama binaries out of asar. No porting. Cons: system-design §9 paths (`src/main/…`, `out/…`, `electron-vite preview`) have to be rewritten.
2. **Scaffold with electron-vite and port node-llama-cpp's build rules into it.** Pros: matches ADR-003's wording and §9's first paths. Cons: we would hand-port the asar and binary rules, which the template already gets right, with no test that the port works on three OSes before the freeze.

### Decision

Use option 1. The app uses the template's layout with Electron `^44.7.0`. `npm run dev` runs the Vite dev server and Electron. `npm start` builds and then runs the built app. The dev-server exception in the network block and the CSP key off `VITE_DEV_SERVER_URL`, not `ELECTRON_RENDERER_URL`.

### Why this option

The template is the part of ADR-003 that carries risk reduction (node-llama-cpp's packaging rules). "electron-vite" was a wrong description of it, not a separate requirement. Spike O1 already ran node-llama-cpp 3.22.1 under Electron 44.7.0 on Windows.

### Overrides

- **Prior ADRs:** supersedes the "via electron-vite" wording in ADR-003 option 4. The rest of ADR-003 (Electron, React, node-llama-cpp, Qwen3.5-2B, local model path) stands.
- **Doc or plan truth:** system-design §9 module map, scripts, and No-network section are rewritten to the template layout in the same change.

### Consequences

- **Easier:** node-llama-cpp's own build rules, unchanged.
- **Harder or owed:** the native host is not a Vite entry of the app build. It gets its own `vite.host.config.ts` (`npm run build:host`), owned by the extension issue.
