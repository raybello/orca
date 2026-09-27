# Install Orca on your computer

These scripts build Orca from this folder and install it for you, so you do not need to set up
anything first. They check for the tools they need and ask before installing each one.

## macOS

1. Open Terminal, go to this folder, and run:

   ```bash
   bash install/install-orca-mac.sh
   ```

   Or double-click `install/install-orca-mac.command` (if macOS blocks it, right-click, choose
   Open, then Open).

2. Answer the questions. The script can install, with your permission:
   - Apple's Command Line Tools (a window from Apple opens)
   - Node.js and pnpm, into `~/.orca-build` (no admin password needed)
   - The Cursor CLI, then it opens your browser so you can sign in to Cursor
3. Wait for the build (10-20 minutes the first time). Orca is installed to `~/Applications/Orca.app`
   and, if you agree, added to your Desktop.

## Windows

1. Double-click `install\install-orca-windows.bat`, or run this in PowerShell:

   ```powershell
   powershell -ExecutionPolicy Bypass -File install\install-orca-windows.ps1
   ```

2. Approve the Windows permission prompt. The script needs Administrator rights to install build
   tools. Use your normal work account, so the Cursor sign-in and Orca end up in your own profile.
3. Answer the questions. The script can install, with your permission: Git, Python, Visual Studio
   Build Tools (large, 10+ minutes), Node.js and pnpm (into `%LOCALAPPDATA%\OrcaBuild`), and the
   Cursor CLI, then it opens your browser so you can sign in to Cursor.
4. Wait for the build (10-20 minutes the first time). Orca is installed with Start menu and Desktop
   shortcuts.

Windows on ARM is not supported by the Windows script.

## Good to know

- Add `--yes` (macOS) or `-Yes` (Windows) to skip the questions and accept everything.
- Logs are saved in `~/.orca-build/logs` (macOS) or `%LOCALAPPDATA%\OrcaBuild\logs` (Windows).
- To update Orca, get the latest version of this folder and run the script again.
- The app is not code-signed. On macOS it is signed locally so it runs on your Mac. On Windows,
  SmartScreen may warn the first time you open it: choose More info, then Run anyway.
