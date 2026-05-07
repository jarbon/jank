#!/usr/bin/env bash
# verify-install.sh — Sanity-check a fresh jank-plugin install.
#
# Run this AFTER installing the plugin in Claude Code / Cursor / Codex
# but BEFORE running /jank for the first time. Catches the most common
# install gaps before they show up as opaque MCP errors mid-run.
#
# Usage: bash scripts/verify-install.sh

set -u
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()    { echo -e "${GREEN}✓${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; FAILED=1; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }

FAILED=0
echo "=== Jank install verifier ==="
echo

# 1. Node 22+
if command -v node >/dev/null 2>&1; then
  NV=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NV" -ge 22 ]; then
    ok "Node $(node -v) (>=22 required)"
  else
    fail "Node $(node -v) is too old — Jank needs Node 22+. Install via nvm: \`nvm install 22\`"
  fi
else
  fail "Node not found in PATH. Install Node 22+ from https://nodejs.org"
fi

# 2. npx (bundled with npm/Node)
if command -v npx >/dev/null 2>&1; then
  ok "npx available"
else
  fail "npx not found. Should ship with Node — try reinstalling Node."
fi

# 3. Reach the npm registry (jank-ai server resolves on first run)
if command -v npm >/dev/null 2>&1; then
  if npm ping --silent >/dev/null 2>&1; then
    ok "npm registry reachable"
  else
    warn "Can't reach npm registry — first /jank run will fail until network is available."
  fi
else
  warn "npm not found in PATH (unusual — should ship with Node)."
fi

# 4. Chrome installed
CHROME_PATHS=(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "/usr/bin/google-chrome-stable"
  "/usr/bin/google-chrome"
  "/usr/bin/chromium-browser"
  "/usr/bin/chromium"
  "$HOME/AppData/Local/Google/Chrome/Application/chrome.exe"
  "/c/Program Files/Google/Chrome/Application/chrome.exe"
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
)
CHROME_FOUND=""
for p in "${CHROME_PATHS[@]}"; do
  if [ -x "$p" ]; then CHROME_FOUND="$p"; break; fi
done
if [ -n "$CHROME_FOUND" ]; then
  ok "Chrome found at $CHROME_FOUND"
else
  fail "Google Chrome not found at any standard path. /jank needs real Chrome (not Chromium-headless-shell). Download: https://www.google.com/chrome/"
fi

# 5. Optional: 'Jank Test' Chrome profile (only required for /jank, not /jank_light or /jank_cloud)
if [ "$(uname)" = "Darwin" ]; then
  CHROME_USER_DATA="$HOME/Library/Application Support/Google/Chrome"
elif [ "$(uname)" = "Linux" ]; then
  CHROME_USER_DATA="$HOME/.config/google-chrome"
else
  CHROME_USER_DATA=""
fi
if [ -n "$CHROME_USER_DATA" ] && [ -d "$CHROME_USER_DATA/Jank Test" ]; then
  ok "Chrome 'Jank Test' profile exists"
else
  warn "Chrome 'Jank Test' profile not found. /jank live tests will fail until you create it:"
  echo "      1. Open Chrome → click avatar (top-right) → 'Add'"
  echo "      2. Name the new profile EXACTLY 'Jank Test'"
  echo "      3. Switch to it and log into staging / SSO if needed"
  echo "      4. Close that profile's window"
  echo "    /jank_light, /jank_cloud, /jank_test (static), /jank_clean don't need this."
fi

# 6. Optional: cloudflared (only required for /jank_cloud localhost)
if command -v cloudflared >/dev/null 2>&1; then
  ok "cloudflared installed (enables /jank_cloud localhost)"
else
  warn "cloudflared not found — /jank_cloud against localhost URLs will need it. Install:"
  echo "      macOS:   brew install cloudflared"
  echo "      Linux:   sudo apt install cloudflared"
  echo "      Windows: winget install --id Cloudflare.cloudflared"
fi

# 7. Optional: git (used for diff-aware focus)
if command -v git >/dev/null 2>&1; then
  ok "git available (enables diff-aware focus on recent changes)"
else
  warn "git not found — Jank works without it but won't auto-focus on recent changes."
fi

# 8. Bundled MCP server present
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLUGIN_ROOT="$( dirname "$SCRIPT_DIR" )"
SERVER="$PLUGIN_ROOT/server/index.js"
if [ -f "$SERVER" ]; then
  SIZE=$(wc -c < "$SERVER" | awk '{print int($1/1024)"KB"}')
  ok "Bundled jank-ai server present at $PLUGIN_ROOT/server/ ($SIZE)"
else
  fail "Bundled server missing at $SERVER — plugin install is incomplete."
fi

echo
if [ "$FAILED" = "1" ]; then
  echo -e "${RED}One or more required checks failed. Fix and re-run.${NC}"
  exit 1
else
  echo -e "${GREEN}All required checks passed.${NC}"
  echo "Run /jank in your coding agent to start."
  exit 0
fi
