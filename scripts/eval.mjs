// `npm run eval`: runs the built eval entry under Electron's own Node (same node:sqlite as the app) without a window.
import {spawnSync} from "node:child_process";
import electron from "electron";

const {status} = spawnSync(electron, ["dist-electron/eval.js", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: {...process.env, ELECTRON_RUN_AS_NODE: "1"}
});
process.exit(status ?? 1);
