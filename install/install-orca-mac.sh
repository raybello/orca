#!/usr/bin/env bash
# Builds Orca and installs it for the current user (macOS).
# Checks the build tools first and asks before installing anything.
# Run it from a checkout, or straight from GitHub (it clones the repo itself):
#   curl -fsSL https://raw.githubusercontent.com/raybello/orca/main/install/install-orca-mac.sh | bash
set -euo pipefail

REPO_URL="${ORCA_REPO_URL:-https://github.com/raybello/orca.git}"
REPO_BRANCH="${ORCA_BRANCH:-main}"
SOURCE_DIR="${ORCA_SOURCE_DIR:-$HOME/Orca}"
# Empty when the script is piped into bash.
SCRIPT_PATH="${BASH_SOURCE[0]:-}"
REPO_ROOT=""
ORCA_HOME="${ORCA_BUILD_HOME:-$HOME/.orca-build}"
NODE_DIR="$ORCA_HOME/node"
TOOLS_DIR="$ORCA_HOME/tools"
LOG_DIR="$ORCA_HOME/logs"
APP_DIR="$HOME/Applications"
ASSUME_YES=0

usage() {
  cat <<USAGE
Usage: install-orca-mac.sh [--yes]

Builds Orca and installs it to ~/Applications. Outside a checkout it first clones
the repo into ~/Orca (override with ORCA_SOURCE_DIR).
  --yes   answer yes to every question (no prompts)

Piped from GitHub: curl -fsSL <script url> | bash -s -- --yes
USAGE
}


say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() { printf '\n\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

# Returns 0 for yes. Default is yes.
confirm() {
  if [ "$ASSUME_YES" = 1 ]; then return 0; fi
  local reply
  read -r -p "  $1 [Y/n] " reply </dev/tty || reply=""
  case "$reply" in n | N | no | No | NO) return 1 ;; *) return 0 ;; esac
}

major_of() { printf '%s' "${1#v}" | cut -d. -f1; }

main() {
  for arg in "$@"; do
    case "$arg" in
      -y | --yes) ASSUME_YES=1 ;;
      -h | --help) usage; exit 0 ;;
      *) echo "Unknown option: $arg" >&2; usage; exit 1 ;;
    esac
  done

  mkdir -p "$LOG_DIR"
  LOG_FILE="$LOG_DIR/install-$(date +%Y%m%d-%H%M%S).log"
  exec > >(tee -a "$LOG_FILE") 2>&1

  [ "$(uname -s)" = "Darwin" ] || die "This script is for macOS. On Windows use install-orca-windows.ps1."
  case "$(uname -m)" in
    arm64) NODE_ARCH=arm64; BUILD_ARCH=--arm64 ;;
    x86_64) NODE_ARCH=x64; BUILD_ARCH=--x64 ;;
    *) die "Unsupported CPU: $(uname -m)" ;;
  esac

  say "Orca installer for macOS"
  echo "  Log file: $LOG_FILE"

  # --- Xcode Command Line Tools (git, compilers, Swift) ---
  say "Checking Xcode Command Line Tools"
  if xcode-select -p >/dev/null 2>&1 && /usr/bin/git --version >/dev/null 2>&1; then
    ok "installed"
  else
    warn "Xcode Command Line Tools are missing. Orca needs them to compile its native parts."
    confirm "Install them now? (Apple's installer opens in a window)" || die "Cannot build without them."
    xcode-select --install >/dev/null 2>&1 || true
    echo "  Click Install in the Apple window. Waiting for it to finish..."
    until xcode-select -p >/dev/null 2>&1 && /usr/bin/git --version >/dev/null 2>&1; do sleep 5; done
    ok "installed"
  fi

  # --- Source code: this checkout, or a fresh clone ---
  say "Getting the Orca source"
  if [ -n "$SCRIPT_PATH" ] && [ -f "$(dirname "$SCRIPT_PATH")/../package.json" ] && [ -f "$(dirname "$SCRIPT_PATH")/../config/electron-builder.config.cjs" ]; then
    REPO_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
    ok "using this checkout: $REPO_ROOT"
  elif [ -d "$SOURCE_DIR/.git" ]; then
    REPO_ROOT="$SOURCE_DIR"
    ok "found $SOURCE_DIR"
    if confirm "Update it to the latest $REPO_BRANCH?"; then
      git -C "$SOURCE_DIR" pull --ff-only origin "$REPO_BRANCH" || warn "Could not update; building the copy you have."
    fi
  elif [ -e "$SOURCE_DIR" ]; then
    die "$SOURCE_DIR already exists and is not an Orca checkout. Move it or set ORCA_SOURCE_DIR."
  else
    confirm "Download Orca from $REPO_URL into $SOURCE_DIR?" || die "Cannot build without the source."
    git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$SOURCE_DIR"
    REPO_ROOT="$SOURCE_DIR"
    ok "downloaded to $SOURCE_DIR"
  fi

  # --- Node.js (major version pinned by package.json engines) ---
  WANT_NODE_MAJOR="$(grep -A2 '"engines"' "$REPO_ROOT/package.json" | sed -n 's/.*"node": *"\([0-9]*\).*/\1/p' | head -1)"
  [ -n "$WANT_NODE_MAJOR" ] || die "Could not read the required Node.js version from package.json."

  say "Checking Node.js $WANT_NODE_MAJOR"
  if [ -x "$NODE_DIR/bin/node" ]; then export PATH="$NODE_DIR/bin:$PATH"; fi
  if command -v node >/dev/null 2>&1 && [ "$(major_of "$(node --version)")" = "$WANT_NODE_MAJOR" ]; then
    ok "found $(node --version)"
  else
    warn "Node.js $WANT_NODE_MAJOR was not found."
    confirm "Download Node.js $WANT_NODE_MAJOR from nodejs.org into $NODE_DIR? (no admin rights needed)" || die "Cannot build without Node.js."
    base="https://nodejs.org/dist/latest-v${WANT_NODE_MAJOR}.x"
    archive="$(curl -fsSL "$base/SHASUMS256.txt" | awk -v s="-darwin-$NODE_ARCH.tar.gz" 'index($2, s) { print $2 }' | head -1)"
    [ -n "$archive" ] || die "Could not find a Node.js $WANT_NODE_MAJOR download for this Mac."
    expected="$(curl -fsSL "$base/SHASUMS256.txt" | awk -v f="$archive" '$2 == f { print $1 }')"
    tmp="$(mktemp -d)"
    curl -fL --progress-bar -o "$tmp/$archive" "$base/$archive"
    [ "$(shasum -a 256 "$tmp/$archive" | awk '{print $1}')" = "$expected" ] || die "Node.js download failed its checksum."
    rm -rf "$NODE_DIR"; mkdir -p "$NODE_DIR"
    tar -xzf "$tmp/$archive" -C "$NODE_DIR" --strip-components=1
    rm -rf "$tmp"
    export PATH="$NODE_DIR/bin:$PATH"
    ok "installed $(node --version)"
  fi

  # --- pnpm ---
  PNPM_VERSION="$(sed -n 's/.*"packageManager": *"pnpm@\([0-9.]*\).*/\1/p' "$REPO_ROOT/package.json" | head -1)"
  say "Checking pnpm"
  if [ -x "$TOOLS_DIR/bin/pnpm" ]; then export PATH="$TOOLS_DIR/bin:$PATH"; fi
  if command -v pnpm >/dev/null 2>&1 && [ "$(major_of "$(pnpm --version)")" -ge 10 ]; then
    ok "found pnpm $(pnpm --version)"
  else
    warn "pnpm was not found."
    confirm "Install pnpm ${PNPM_VERSION:-latest} into $TOOLS_DIR?" || die "Cannot build without pnpm."
    npm install -g "pnpm@${PNPM_VERSION:-latest}" --prefix "$TOOLS_DIR" >/dev/null
    export PATH="$TOOLS_DIR/bin:$PATH"
    ok "installed pnpm $(pnpm --version)"
  fi

  # --- Cursor CLI ---
  find_cursor_agent() {
    local candidate
    for candidate in "$HOME/.local/bin/agent" "$HOME/.local/bin/cursor-agent"; do
      if [ -x "$candidate" ]; then echo "$candidate"; return 0; fi
    done
    command -v cursor-agent 2>/dev/null || command -v agent 2>/dev/null || true
  }

  say "Checking Cursor CLI"
  CURSOR_AGENT="$(find_cursor_agent)"
  NEEDS_LOGIN=0
  if [ -n "$CURSOR_AGENT" ]; then
    ok "found $CURSOR_AGENT"
    confirm "Sign in to Cursor now?" && NEEDS_LOGIN=1
  else
    warn "Cursor CLI is not installed."
    if confirm "Install it now? (runs Cursor's installer from https://cursor.com/install)"; then
      curl -fsS https://cursor.com/install | bash
      export PATH="$HOME/.local/bin:$PATH"
      CURSOR_AGENT="$(find_cursor_agent)"
      [ -n "$CURSOR_AGENT" ] && ok "installed $CURSOR_AGENT" || warn "Installed, but the command was not found. Open a new Terminal and run: agent login"
      NEEDS_LOGIN=1
    else
      warn "Skipping Cursor CLI."
    fi
  fi
  if [ "$NEEDS_LOGIN" = 1 ] && [ -n "$CURSOR_AGENT" ]; then
    echo "  Your browser will open so you can sign in to Cursor."
    "$CURSOR_AGENT" login || warn "Sign-in did not finish. Run 'agent login' later to try again."
  fi

  # --- Build ---
  cd "$REPO_ROOT"
  export NODE_OPTIONS="--max-old-space-size=4096"

  say "Installing dependencies (a few minutes)"
  pnpm install --frozen-lockfile
  (cd mobile && pnpm install --frozen-lockfile)

  say "Building Orca (10-20 minutes the first time)"
  pnpm run build:release
  pnpm run ensure:electron-runtime

  say "Packaging the app"
  COMMIT="$(git rev-parse --short=12 HEAD 2>/dev/null || echo nogit)"
  BUILD_VERSION="$(node -e "
  const v = require('./package.json').version
  console.log(v + (v.includes('-') ? '.' : '-') + 'local.' + Date.now() + '.$COMMIT')")"
  CSC_IDENTITY_AUTO_DISCOVERY=false ORCA_BUILD_COMMIT="$COMMIT" ORCA_LOCAL_BUILD_VERSION="$BUILD_VERSION" \
    pnpm exec electron-builder --config config/electron-builder.config.cjs --mac dir "$BUILD_ARCH"

  BUILT_APP="$(find dist -maxdepth 2 -name '*.app' -type d -exec ls -dt {} + | head -1)"
  [ -n "$BUILT_APP" ] || die "The build finished but no .app was found in dist/."

  # --- Install ---
  say "Installing to $APP_DIR"
  APP_NAME="$(basename "$BUILT_APP")"
  mkdir -p "$APP_DIR"
  if pgrep -x "${APP_NAME%.app}" >/dev/null 2>&1; then
    warn "${APP_NAME%.app} is running. Quit it first so it can be replaced."
    confirm "Quit it now?" && osascript -e "tell application \"${APP_NAME%.app}\" to quit" || true
    sleep 3
  fi
  rm -rf "${APP_DIR:?}/$APP_NAME"
  ditto "$BUILT_APP" "$APP_DIR/$APP_NAME"
  xattr -cr "$APP_DIR/$APP_NAME" 2>/dev/null || true
  # Apple Silicon refuses unsigned apps, so fall back to an ad-hoc signature.
  codesign --verify --deep "$APP_DIR/$APP_NAME" >/dev/null 2>&1 || codesign --force --deep --sign - "$APP_DIR/$APP_NAME"
  ok "installed $APP_DIR/$APP_NAME"

  if confirm "Add a shortcut to the Desktop?"; then
    rm -f "$HOME/Desktop/${APP_NAME%.app}" "$HOME/Desktop/$APP_NAME"
    osascript -e "tell application \"Finder\" to make alias file to POSIX file \"$APP_DIR/$APP_NAME\" at POSIX file \"$HOME/Desktop\"" >/dev/null 2>&1 \
      || ln -sfn "$APP_DIR/$APP_NAME" "$HOME/Desktop/$APP_NAME"
    ok "Desktop shortcut created"
  fi

  say "Done"
  echo "  Orca is in $APP_DIR (also findable in Spotlight)."
  confirm "Open Orca now?" && open "$APP_DIR/$APP_NAME" || true
}

# Reading prompts from the terminal keeps commands run by main from swallowing the piped script.
if (: </dev/tty) 2>/dev/null; then
  main "$@" </dev/tty
else
  main "$@"
fi
