import {execFileSync} from "node:child_process";
import {createHash, createPublicKey} from "node:crypto";
import {existsSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const HOST = "com.focuslocal.ledger";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hostJs = path.join(repo, "out", "native-host", "host.js");
const bat = path.join(path.dirname(hostJs), "ledger-host.bat");
const manifestPath = path.join(path.dirname(hostJs), `${HOST}.json`);
const launcherHeader = "@echo off\r\nrem Ledger native-messaging launcher\r\n";
const keys = ["Google\\Chrome", "Microsoft\\Edge", "BraveSoftware\\Brave-Browser"]
    .map((browser) => `Software\\${browser}\\NativeMessagingHosts\\${HOST}`);

// .NET distinguishes absent keys from access errors without parsing localized reg.exe output.
// Encoded data and -EncodedCommand keep checkout paths out of shell quoting/interpolation.
/**
 * Preserves registry entries belonging to other checkouts.
 * @param {"check" | "install" | "uninstall"} action Registration operation.
 */
function registry(action) {
    const data = Buffer.from(JSON.stringify({action, keys, manifestPath})).toString("base64");
    const script = `
$ErrorActionPreference = 'Stop'
$data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
$root = [Microsoft.Win32.Registry]::CurrentUser
if ($data.action -ne 'uninstall') {
    foreach ($name in $data.keys) {
        $key = $root.OpenSubKey($name, $false)
        if ($null -eq $key) { continue }
        try {
            $value = $key.GetValue('', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            if ($null -ne $value -and ($value -isnot [string] -or $value -ine $data.manifestPath)) {
                throw "Refusing to replace another native host: HKCU\\$name"
            }
        } finally { $key.Dispose() }
    }
}
if ($data.action -eq 'check') { exit 0 }
foreach ($name in $data.keys) {
    if ($data.action -eq 'install') {
        $key = $root.CreateSubKey($name)
        try { $key.SetValue('', $data.manifestPath, [Microsoft.Win32.RegistryValueKind]::String) }
        finally { $key.Dispose() }
        Write-Output "Registered HKCU\\$name"
    } else {
        $key = $root.OpenSubKey($name, $true)
        if ($null -eq $key) { continue }
        $empty = $false
        try {
            $value = $key.GetValue('', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            if ($value -is [string] -and $value -ieq $data.manifestPath) {
                $key.DeleteValue('', $false)
                $empty = $key.ValueCount -eq 0 -and $key.SubKeyCount -eq 0
                Write-Output "Removed registration HKCU\\$name"
            } else {
                Write-Output "Preserved unrelated registration HKCU\\$name"
            }
        } finally { $key.Dispose() }
        if ($empty) { $root.DeleteSubKey($name, $false) }
    }
}
`;
    execFileSync(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), [
        "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")
    ], {stdio: "inherit", windowsHide: true});
}

/**
 *
 */
function assertOwnedFiles() {
    if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        if (manifest.name !== HOST || typeof manifest.path !== "string"
            || path.resolve(manifest.path).toLowerCase() !== bat.toLowerCase()) {
            throw new Error(`Refusing to change an unrelated manifest: ${manifestPath}`);
        }
    }
    if (existsSync(bat) && !readFileSync(bat, "utf8").startsWith(launcherHeader)) {
        throw new Error(`Refusing to change an unrelated launcher: ${bat}`);
    }
}

/**
 *
 */
function install() {
    if (!existsSync(hostJs) || !statSync(hostJs).isFile()) {
        throw new Error("Run npm run build:host first");
    }
    const require = createRequire(import.meta.url);
    // Do not let Electron's lazy package entry download a binary during host installation.
    const electronDir = path.dirname(require.resolve("electron/package.json"));
    const pathFile = path.join(electronDir, "path.txt");
    const executable = existsSync(pathFile) ? readFileSync(pathFile, "utf8").trim() : "electron.exe";
    const installedExe = path.resolve(process.env.ELECTRON_OVERRIDE_DIST_PATH ?? path.join(electronDir, "dist"), executable);
    if (!existsSync(installedExe) || !statSync(installedExe).isFile() || !existsSync(pathFile)) {
        throw new Error("Electron binary missing; finish Electron setup before installing the native host");
    }
    const electronExe = require("electron");
    if (typeof electronExe !== "string" || !path.isAbsolute(electronExe) || !statSync(electronExe).isFile()) {
        throw new Error("Run this installer with system Node and an installed Electron binary");
    }
    const {key} = JSON.parse(readFileSync(path.join(repo, "extension", "manifest.json"), "utf8"));
    if (typeof key !== "string") {
        throw new Error("Extension manifest is missing its public key");
    }
    const der = Buffer.from(key, "base64");
    if (createPublicKey({key: der, format: "der", type: "spki"}).asymmetricKeyType !== "rsa") {
        throw new Error("Extension manifest key must be an RSA public key");
    }
    const hash = createHash("sha256").update(der)
        .digest("hex");
    const id = [...hash.slice(0, 32)].map((digit) => String.fromCharCode(97 + parseInt(digit, 16))).join("");
    // Quotes protect spaces and metacharacters; %% prevents expansion of literal path percent signs.
    const quote = (value) => {
        if (/["\r\n]/u.test(value)) {
            throw new Error("Native host paths cannot contain quotes or newlines");
        }
        return `"${value.replaceAll("%", "%%")}"`;
    };
    const launcher = launcherHeader + [
        "setlocal DisableDelayedExpansion",
        "chcp 65001 >nul",
        "set \"ELECTRON_RUN_AS_NODE=1\"",
        `${quote(electronExe)} ${quote(hostJs)} %*`,
        "exit /b %errorlevel%",
        ""
    ].join("\r\n");
    assertOwnedFiles();
    registry("check");
    writeFileSync(bat, launcher, "utf8");
    writeFileSync(manifestPath, JSON.stringify({
        name: HOST,
        description: "Ledger active-tab relay",
        path: bat,
        type: "stdio",
        "allowed_origins": [`chrome-extension://${id}/`]
    }, null, 4) + "\n", "utf8");
    registry("install");
    console.log(`Extension ID: ${id}\nNative host manifest: ${manifestPath}`);
}

try {
    if (process.platform !== "win32") {
        throw new Error("macOS/Linux host install is Later (not in this issue)");
    }
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== "--uninstall")) {
        throw new Error("Usage: node scripts/install-native-host.mjs [--uninstall]");
    }
    if (args[0] === "--uninstall") {
        // Cleanup must still work if the host build or Electron binary has been removed.
        assertOwnedFiles();
        registry("uninstall");
        for (const file of [bat, manifestPath]) {
            if (existsSync(file)) {
                rmSync(file);
                console.log(`Removed ${file}`);
            }
        }
    } else {
        install();
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
