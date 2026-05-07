# jank-plugin — Claude Code

Quality checks for AI coding agents. Adds 6 slash commands to Claude Code.

| Command | What it does | Setup needed |
|---|---|---|
| **`/jank_light`** | Pure static scan — code-only, no browser, no MCP, no setup. Catches GenAI-typical bugs (leaked secrets, hallucinated APIs, mock data left in prod, stray `console.log`). | None |
| **`/jank`** | Full quality sweep — static scan + 10 AI testers in real Chrome (headless, your real cookies). | One-time `Jank Test` Chrome profile |
| **`/jank_test "<feature>"`** | Surgical: tell us in plain English what to test. 2 focused agents exercise exactly that and return PASS/FAIL. | Same as `/jank` |
| **`/jank_explore`** | 5 user-style agents (Kelly, Greg, Maria, Sam, Robin) act in your app with realistic data. Finds functional breaks, not quality nits. | Same as `/jank` |
| **`/jank_cloud <url>`** | Hosted audit on reports.jank.ai. Auto-tunnels localhost via Cloudflared. 3 free reports on signup. | None (cloudflared optional) |
| **`/jank_clean`** | Reap zombie Chrome from a cancelled run. Auto-runs at plugin startup too. | None |

## Install

### Quick install (Claude Code)

The plugin is distributed as a single `.dxt` file (closed-source bundle, not
on a public Git repo). Drop it into Claude's plugin dir and verify:

```bash
# 1. Drop the .dxt or unpacked plugin folder into Claude Code's plugins
#    (you'll receive a download link from testers.ai when you sign up)
mkdir -p ~/.claude/plugins
mv ~/Downloads/jank-plugin-*/ ~/.claude/plugins/jank-plugin

# 2. Verify your machine is ready (Node 22+, Chrome, etc.)
bash ~/.claude/plugins/jank-plugin/scripts/verify-install.sh

# 3. Restart Claude Code. /jank_light, /jank_cloud, /jank_clean work immediately.
```

### One-time `Jank Test` Chrome profile (only for `/jank`, `/jank_test`, `/jank_explore`)

The shipped `.mcp.json` defaults to **fast headless mode** that reuses your real Chrome's cookies / cache / extensions / SSO via a dedicated sub-profile. Set up once:

1. Open Chrome → click avatar (top-right) → **Add**
2. Name the new profile **exactly** `Jank Test`
3. Switch to it and log into staging / SSO / what you want tested
4. Close that profile's window. Your normal Chrome on `Default` keeps running, untouched.

After that, every browser-based `/jank` run is **invisible (headless)**, **fast**, and **fully logged in**.

`/jank_light`, `/jank_cloud`, `/jank_clean` work without this step.

## Requirements

- **Node 22+** — required for built-in WebSocket and fetch in our CDP browser controller
- **Google Chrome** — real Chrome, not Chromium-headless-shell
- **git** (optional) — enables diff-aware focus on your recent changes
- **cloudflared** (optional) — only for `/jank_cloud` against `localhost`

`scripts/verify-install.sh` checks all of these.

## What's where

```
jank-plugin/
├── .claude-plugin/plugin.json   ← Claude Code manifest
├── .mcp.json                    ← jank-ai + Playwright MCP wiring
├── mcp/playwright-launch.mjs    ← Playwright launcher (shared-profile + headless)
├── scripts/verify-install.sh    ← One-shot install checker
└── skills/
    ├── jank/SKILL.md            ← /jank
    ├── jank_light/SKILL.md      ← /jank_light
    ├── jank_test/SKILL.md       ← /jank_test
    ├── jank_explore/SKILL.md    ← /jank_explore
    ├── jank_cloud/SKILL.md      ← /jank_cloud
    ├── jank_clean/SKILL.md      ← /jank_clean
    ├── feedback/SKILL.md        ← persona-feedback
    ├── index/SKILL.md           ← quality leaderboard
    ├── explore/SKILL.md         ← exploratory testing (legacy entry)
    └── test/SKILL.md            ← website testing (legacy entry)
```

The MCP servers are **auto-installed via npx** on first use — no manual `npm install`. The `.mcp.json` references `@jank-ai/mcp-server` (jank's tools) and `@playwright/mcp` (browser control); both are pulled from npm on first invocation and cached locally.

## Plan limits

- **Demo (no signup):** 1 successful submit per email per UTC day; teaser report (3 issues, 1 of 4 personas, 2 of 7 flows visible).
- **Free signup** ([reports.testers.ai/signup](https://reports.testers.ai/signup)): 3 lifetime full reports.
- **Starter / Pro / Team:** 20 / 75 / 300 reports per month. See [pricing](https://reports.testers.ai/pricing).

## Sample report

<https://reports.jank.ai/r/609d2e2a-30a9-4739-bd6f-b361b1f510b8> — Starbucks audit, full feature set.

## Documentation

- [API reference](https://jank.ai/api)
- [Live admin](https://reports.testers.ai/admin)
- Cursor port: [`marketplace/cursor/jank-cursor/`](../../cursor/jank-cursor/)
- Codex port: [`marketplace/codex/jank-codex/`](../../codex/jank-codex/)

## License

Proprietary — © testers.ai. All rights reserved. Closed source; redistribution and modification prohibited without written permission.
