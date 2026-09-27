#!/usr/bin/env bash
# Removes an Orca install created by install-orca-mac.sh (macOS).
# Asks before deleting anything, and defaults to keeping your data and the source checkout.
# Run it from a checkout, or straight from GitHub:
#   curl -fsSL https://raw.githubusercontent.com/raybello/orca/main/config/installers/uninstall-orca-mac.sh | bash
set -euo pipefail

APP_DIR="${ORCA_APP_DIR:-$HOME/Applications}"
APP_NAME="Orca.app"
BUNDLE_ID="com.stablyai.orca"
SOURCE_DIR="${ORCA_SOURCE_DIR:-$HOME/Orca}"
ORCA_HOME="${ORCA_BUILD_HOME:-$HOME/.orca-build}"
# Electron's userData/updater-cache folder names come from package.json's "name" ("orca"),
# not the "Orca" productName used for the .app bundle and installer.
USER_DATA_DIR="$HOME/Library/Application Support/orca"
UPDATER_CACHE_DIR="$HOME/Library/Application Support/orca-updater"
SHIPIT_DIR="$HOME/Library/Application Support/$BUNDLE_ID.ShipIt"
CACHES_DIR="$HOME/Library/Caches/$BUNDLE_ID"
SAVED_STATE_DIR="$HOME/Library/Saved Application State/$BUNDLE_ID.savedState"
PREFS_FILE="$HOME/Library/Preferences/$BUNDLE_ID.plist"
ASSUME_YES=0

usage() {
  cat <<USAGE
Usage: uninstall-orca-mac.sh [--yes]

Removes the Orca app and its Desktop shortcut. Asks before deleting your Orca
settings/history, the downloaded source (~/Orca) and the build tool cache
(~/.orca-build); each defaults to "keep" unless you say yes.
  --yes   answer yes to every question, INCLUDING deleting data/source/tools
USAGE
}

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
skip() { printf '  - %s\n' "$*"; }

# Returns 0 for yes. $2, if given, is the default answer when input is empty ("y" or "n").
confirm() {
  if [ "$ASSUME_YES" = 1 ]; then return 0; fi
  local prompt reply default="${2:-y}"
  if [ "$default" = "y" ]; then prompt="[Y/n]"; else prompt="[y/N]"; fi
  read -r -p "  $1 $prompt " reply </dev/tty || reply=""
  if [ -z "$reply" ]; then reply="$default"; fi
  case "$reply" in y | Y | yes | Yes | YES) return 0 ;; *) return 1 ;; esac
}

main() {
  for arg in "$@"; do
    case "$arg" in
      -y | --yes) ASSUME_YES=1 ;;
      -h | --help) usage; exit 0 ;;
      *) echo "Unknown option: $arg" >&2; usage; exit 1 ;;
    esac
  done

  [ "$(uname -s)" = "Darwin" ] || { echo "This script is for macOS. On Windows use uninstall-orca-windows.ps1." >&2; exit 1; }

  say "Orca uninstaller for macOS"

  local app_path=""
  if [ -d "$APP_DIR/$APP_NAME" ]; then
    app_path="$APP_DIR/$APP_NAME"
  else
    # install-orca-mac.sh always installs to ~/Applications; this covers a moved copy.
    app_path="$(mdfind "kMDItemCFBundleIdentifier == '$BUNDLE_ID'" 2>/dev/null | head -1)"
  fi

  if [ -z "$app_path" ]; then
    warn "No installed Orca app was found (looked in $APP_DIR)."
  else
    say "Removing the app"
    if pgrep -x "Orca" >/dev/null 2>&1; then
      warn "Orca is running. Quit it first so it can be removed."
      confirm "Quit it now?" && osascript -e 'tell application "Orca" to quit' || true
      sleep 2
    fi
    rm -rf "$app_path"
    ok "removed $app_path"
  fi

  say "Removing shortcuts"
  local removed_shortcut=0
  for candidate in "$HOME/Desktop/Orca" "$HOME/Desktop/Orca.app"; do
    # -L also catches an alias/symlink left dangling now that the app above is gone.
    if [ -e "$candidate" ] || [ -L "$candidate" ]; then rm -f "$candidate"; removed_shortcut=1; fi
  done
  if [ "$removed_shortcut" = 1 ]; then ok "removed the Desktop shortcut"; else skip "no Desktop shortcut found"; fi

  say "Your Orca settings and history"
  if [ -d "$USER_DATA_DIR" ] || [ -d "$UPDATER_CACHE_DIR" ] || [ -d "$SHIPIT_DIR" ] || [ -d "$CACHES_DIR" ] || [ -d "$SAVED_STATE_DIR" ] || [ -f "$PREFS_FILE" ]; then
    if confirm "Delete Orca's saved settings, history and cache too? This cannot be undone." n; then
      rm -rf "$USER_DATA_DIR" "$UPDATER_CACHE_DIR" "$SHIPIT_DIR" "$CACHES_DIR" "$SAVED_STATE_DIR" "$PREFS_FILE"
      ok "deleted Orca's app data"
    else
      skip "kept $USER_DATA_DIR"
    fi
  else
    skip "none found"
  fi

  say "The downloaded source"
  if [ -d "$SOURCE_DIR/.git" ]; then
    if confirm "Delete the downloaded source at $SOURCE_DIR too?" n; then
      rm -rf "$SOURCE_DIR"
      ok "deleted $SOURCE_DIR"
    else
      skip "kept $SOURCE_DIR"
    fi
  else
    skip "no clone found at $SOURCE_DIR"
  fi

  say "The build tool cache"
  if [ -d "$ORCA_HOME" ]; then
    if confirm "Delete the Node.js/pnpm build cache at $ORCA_HOME too?" n; then
      rm -rf "$ORCA_HOME"
      ok "deleted $ORCA_HOME"
    else
      skip "kept $ORCA_HOME"
    fi
  else
    skip "none found"
  fi

  say "Done"
  echo "  Orca has been uninstalled."
}

# Reading prompts from the terminal keeps this working when piped from curl.
if (: </dev/tty) 2>/dev/null; then
  main "$@" </dev/tty
else
  main "$@"
fi
