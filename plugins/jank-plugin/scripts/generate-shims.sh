#!/usr/bin/env bash
# generate-shims.sh — Replace commands/*.md and skills/*/SKILL.md in the
# published marketplace plugin with thin shims that delegate to the
# bundled MCP server.
#
# Why: the playbook bodies (the prompts, personas, eval rubric) used to
# ship as plaintext SKILL.md files. Anyone with the install could `cat`
# them. We now bundle the playbook content into the minified MCP server
# (server/index.js) and ship just one-line shims here. Same install UX,
# but the IP is only readable at the same level as the rest of the
# minified server code.
#
# Run after editing any jankplugin/playbooks-source/*.md.

set -euo pipefail
cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Pull descriptions from the DXT manifest — clean one-liners curated for
# the slash-menu autocomplete subtitle.
MANIFEST="$( cd ../../../jankplugin && pwd )/manifest.json"

mkdir -p commands

# Drop any old plaintext skill bodies — they're the IP we're hiding. The
# new shipping artifact has commands/ only; skills/ is no longer needed
# (the slash-menu reads commands/, the bundled server has the playbooks).
if [ -d skills ]; then
  echo "▸ removing old plaintext skills/ dir (no longer shipped)"
  rm -rf skills
fi

python3 - "$MANIFEST" <<'PY'
import json, sys, pathlib
manifest = json.load(open(sys.argv[1]))
descs = {p["name"]: p["description"] for p in manifest.get("prompts", [])}

cmd_dir = pathlib.Path("commands")
cmd_dir.mkdir(exist_ok=True)

# Wipe stale commands first so renames don't leave orphans.
for f in cmd_dir.glob("*.md"):
    f.unlink()

shim = """---
description: {desc}
---

> The full playbook for this command lives inside the `jank-ai` MCP
> server (bundled, minified). To run `/{name}` correctly, you must call
> the server first, then follow what it returns.

**Step 1 — Fetch the playbook:**

Call `mcp__jank-ai__jank_get_playbook` with `name="{name}"`.

**Step 2 — Follow the returned instructions exactly.**

The user's typed arguments (URL, options, target file, etc.) are in
`$ARGUMENTS` — pass them to the playbook tools as the returned
instructions describe.

**Browser-driving commands (`/jank`, `/jank_test`, `/jank_explore`)
spawn their own Chrome window** with a persistent profile at
`~/.jank/chrome-profile`. No setup needed, no debug-port flags, no
attach-to-running-Chrome juggling. Cookies and logins persist across
runs — log into a site once during the first run, future runs see the
cookie.

When the playbook tells you to call `mcp__jank-ai__jank_open_tabs`,
just call it. It'll spawn Chrome cleanly. The first run of the day may
take a few extra seconds while Chrome seeds the profile dir.

If `jank_open_tabs` fails ("profile in use", "spawn ENOENT", etc.),
run `mcp__jank-ai__jank_clean` to reap any zombie Chrome processes
holding the profile lock, then retry.

If the user explicitly wants static-only — say "skip the browser" —
direct them to `/jank_light` and stop. Don't try to half-run /{name}
without the browser pass; the live-browser personas are half the value.

If `jank_get_playbook` returns an error, the `jank-ai` MCP server isn't
loaded — the user's plugin install is incomplete. Tell them to verify
`~/.claude/plugins/jank-plugin/server/index.js` exists and that they
restarted Claude Desktop fully (⌘Q + relaunch).
"""

written = 0
for name, desc in descs.items():
    (cmd_dir / f"{name}.md").write_text(shim.format(name=name, desc=desc))
    written += 1
    print(f"  wrote commands/{name}.md  — {desc[:60]}")

print(f"✔ generated {written} command shim(s) (avg ~{(cmd_dir / 'jank.md').stat().st_size}B each)")
PY
