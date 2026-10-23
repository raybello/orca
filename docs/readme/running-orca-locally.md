# Running Orca locally from source

Two ways to run a build you made yourself. Neither packages an installer.

| Path | Command | Use it for |
| --- | --- | --- |
| Dev (HMR) | `pnpm run dev` | day-to-day work: renderer hot reload, app restart on main/preload edits |
| Production bundles | `pnpm run build:electron-vite`, then launch Electron | checking the real, bundled renderer |

Packaging an installer is a different path — see [Out of scope](#out-of-scope).

Measured on Windows 11 x64 with Node 24.22.1 and pnpm 12.8.1.

## Prerequisites

- **Node 24.** `package.json` pins `engines.node: 24`, and the install/build scripts load `.ts`
  files directly — Node 22 cannot, so they fail. `node -v` on a stock machine here is 22.11.
- **pnpm 12.8.1** (the `packageManager` pin; pnpm re-executes the pinned version automatically).
- **Visual Studio C++ build tools + Python 3** for the `node-gyp` rebuilds (`node-pty`,
  `@vscode/windows-process-tree`).
- Network access on first run for the Electron 43.7.8 download.

On PowerShell, call `pnpm.cmd`: `pnpm.ps1` is blocked when script execution is disabled.

## Setup (once, both paths)

### 1. Put Node 24 on PATH

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-v24\node-v24.22.1-win-x64;$env:PATH"
node -v   # v24.x
```

### 2. Install dependencies

```powershell
pnpm.cmd install --frozen-lockfile
```

The root `postinstall` runs `build:packages` and the native rebuild, so this also installs the
Electron binary and builds the patched `node-pty`.

If the install ever ran under Node older than 22.12, redo it once with `--force`, otherwise the
build fails later, far from the cause.

```powershell
pnpm.cmd install --frozen-lockfile --force
```

### 3. Ensure the Electron runtime

```powershell
node config/scripts/rebuild-native-deps.mjs
```

Idempotent. Expected ending: `Native modules already load in Electron; skipping rebuild.`

## Dev build (HMR)

### 4. Start it

```powershell
pnpm.cmd run dev
```

`build:packages` and the native runtime check run first, then `electron-vite dev` serves the
renderer from `http://localhost:5173` and launches Electron against it. Renderer edits hot-reload;
main/preload edits rebuild and restart the app.

First lines to expect:

```
[orca-dev] Prepared wrapper in C:\Users\raymo\Github\orca\out\bin
[orca-dev] Instance: orca @ main
[orca-dev] Remote debugging on http://127.0.0.1:9386
  ➜  Local:   http://localhost:5173/
starting electron app...
```

Notes:

- The window title carries the instance label (`Orca: <branch>`); the `orca-dev` CLI wrapper is
  written to `out/bin` and prepended to the PATH that Orca hands to its terminals.
- A CDP port is picked per worktree in 9333–9532 and printed. Pin it with
  `$env:REMOTE_DEBUGGING_PORT='9222'`; passing `--remote-debugging-port` yourself disables the
  injection.
- Off-screen run (automation that must not steal focus):
  `$env:ORCA_BACKGROUND_LAUNCH='1'` keeps the window hidden and logs
  `Background launch: window stays off screen; automate through CDP`.
- `pnpm.cmd run dev-stable-name` keeps Electron's stock app name, for tools that key on `Electron`.
- Browser pairing needs the web bundle; the run warns
  `Web client bundle missing; skipping pairing web build` unless `out/web` exists
  (`pnpm.cmd run build:web`) or `ORCA_DEV_WEB_PREPARE=1` is set.
- Stop with Ctrl+C — the runner kills the whole child tree (`taskkill /t /f` on Windows).

The dev runner clears `ELECTRON_RUN_AS_NODE` itself, so the `isPackaged` trap below only bites when
you launch Electron by hand.

## Production build

### 4. Build the bundles

```powershell
pnpm.cmd run build:electron-vite
```

Writes `out/main`, `out/preload`, `out/renderer` and ends with
`Renderer boot graph: <n> chunks, <n> KB minified`.

### 5. Launch

```powershell
$env:ELECTRON_RUN_AS_NODE = $null
.\node_modules\electron\dist\electron.exe .
```

A window titled **Orca** opens on the built renderer.

Scripted alternative: `pnpm.cmd start` (`build:packages` → `ensure:electron-runtime` →
`electron-vite preview`, which rebuilds and then launches). Same environment caveat applies.

## What you get either way

- **Not a packaged app.** `app.isPackaged` is false, so the run uses its own profile at
  `%APPDATA%\orca-dev`, advertises the CLI as `orca-dev`, and takes a single-instance lock only
  against other source runs — it does not collide with an installed Orca.
- **Logs:** `%APPDATA%\orca-dev\logs\main.trace.ndjson` and `daemon.log`.
- **Quit:** close the window (dev: or Ctrl+C in the terminal).

## Traps

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".ts"` during install, then `Electron install failed` | build script ran on Node 22 | use Node 24 (step 1) |
| `Cannot find module '@rolldown/binding-win32-x64-msvc'` (same for `@oxlint`/`@oxfmt`) | first install ran under Node <22.12; pnpm skips optional deps whose `engines` do not match, and the pin is `>=22.12` | `pnpm.cmd install --frozen-lockfile --force` under Node 24 |
| `[bootstrap] fatal-exit ... TypeError: Cannot read properties of undefined (reading 'isPackaged')` | `ELECTRON_RUN_AS_NODE=1` is exported in the shell, so Electron runs as plain Node and `require('electron')` is a path | clear it before launching (`$env:ELECTRON_RUN_AS_NODE = $null`); `pnpm run dev` already does |
| Window never appears but the process lives | hidden/background launch | unset `ORCA_BACKGROUND_LAUNCH`; set it to `1` only for off-screen automation runs |
| `Web client bundle missing; skipping pairing web build` | `out/web` was never built | `pnpm.cmd run build:web`, or set `ORCA_DEV_WEB_PREPARE=1` |

## Out of scope

- **Installers** (`pnpm build:win`): packaging copies `native/windows-cli-launcher/.build/orca.exe`
  and `native/windows-agent-hook/.build/orca-agent-hook.exe`, which need the Rust toolchain, and
  `beforePack` fails when they are missing.
- **Typecheck:** `pnpm build:desktop` runs `pnpm tc` first; both paths here skip it deliberately.

## Timings

| Step | Time |
| --- | --- |
| `pnpm install --frozen-lockfile` | ~3 min |
| `pnpm install --frozen-lockfile --force` (only if recovering) | ~6 min |
| `pnpm run build:electron-vite` | ~1.5 min |
| `pnpm run dev` to first window (workspace already built) | ~35 s |
| `electron-vite preview` rebuild (inside `pnpm start`) | ~40 s |
