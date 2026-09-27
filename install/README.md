# Install Orca on your computer

Copy one line, paste it, and answer the questions. The installer downloads Orca, checks for the
tools it needs, asks before installing each one, and builds and installs the app. You do not need
to set up anything first.

## One-line install

**macOS**: open Terminal and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/raybello/orca/main/install/install-orca-mac.sh | bash
```

**Windows**: open PowerShell (or Command Prompt) and paste:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/raybello/orca/main/install/install-orca-windows.ps1 -OutFile $env:TEMP\install-orca.ps1; & $env:TEMP\install-orca.ps1"
```

Orca's source is downloaded to a folder named `Orca` in your home folder. To update Orca later, run
the same line again.

## Already have this folder?

Run the script from it instead:

- macOS: `bash install/install-orca-mac.sh` (or double-click `install/install-orca-mac.command`;
  if macOS blocks it, right-click, choose Open, then Open)
- Windows: double-click `install\install-orca-windows.bat`

## What it does

1. Downloads Orca (needs Git; the script offers to install it).
2. Checks the build tools and asks before installing each missing one:
   - macOS: Apple's Command Line Tools (a window from Apple opens); Node.js 24 and pnpm go into
     `~/.orca-build`, so no admin password is needed.
   - Windows: Python, Visual Studio C++ Build Tools (large, 10+ minutes), Node.js 24 and pnpm (into
     `%LOCALAPPDATA%\OrcaBuild`). Windows asks for permission to run as Administrator; use your
     normal work account so Orca ends up in your own profile.
3. Offers to install the Cursor CLI, then opens your browser so you can sign in to Cursor.
4. Builds Orca (10-20 minutes the first time) and installs it. macOS: `~/Applications/Orca.app`,
   plus a Desktop shortcut if you agree. Windows: Start menu and Desktop shortcuts.

Windows on ARM is not supported by the Windows script.

## Good to know

- To skip every question and accept everything, add `--yes` on macOS
  (`... | bash -s -- --yes`) or `-Yes` on Windows (add it after the script path).
- Logs are saved in `~/.orca-build/logs` (macOS) or `%LOCALAPPDATA%\OrcaBuild\logs` (Windows).
- The app is not code-signed. On macOS it is signed locally so it runs on your Mac. On Windows,
  SmartScreen may warn the first time you open it: choose More info, then Run anyway.
