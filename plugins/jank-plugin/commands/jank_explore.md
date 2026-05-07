---
description: 5 user-style agents act in your app — find functional breaks
---

> The full playbook for this command lives inside the `jank-ai` MCP
> server (bundled, minified). To run `/jank_explore` correctly, you must call
> the server first, then follow what it returns.

**Step 1 — Fetch the playbook:**

Call `mcp__jank-ai__jank_get_playbook` with `name="jank_explore"`.

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
direct them to `/jank_light` and stop. Don't try to half-run /jank_explore
without the browser pass; the live-browser personas are half the value.

If `jank_get_playbook` returns an error, the `jank-ai` MCP server isn't
loaded — the user's plugin install is incomplete. Tell them to verify
`~/.claude/plugins/jank-plugin/server/index.js` exists and that they
restarted Claude Desktop fully (⌘Q + relaunch).
