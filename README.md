# Jank — Claude Code plugin

Quality checks for AI coding agents. Six bare slash commands inside Claude Desktop's Code tab.

## Install

Copy/paste, then ⌘Q Claude Desktop and relaunch.

```bash
git clone https://github.com/jarbon/jank.git /tmp/jank
mkdir -p ~/.claude/plugins ~/.claude/commands
cp -r /tmp/jank/plugins/jank-plugin ~/.claude/plugins/
ln -sf ~/.claude/plugins/jank-plugin/commands/*.md ~/.claude/commands/
node ~/.claude/plugins/jank-plugin/scripts/register-mcp.js
rm -rf /tmp/jank
```

The 5th line registers the bundled MCP server in `~/Library/Application Support/Claude/claude_desktop_config.json` so Claude Desktop spawns it on launch. Idempotent + backs up your config first; safe to re-run on upgrades.

Then **⌘Q Claude Desktop** (full quit, not just close window) → relaunch → open the **Code** tab → type `/`.

## Slash commands

| Command | What it does |
|---|---|
| `/jank` | Full quality sweep — code + live browser, every category |
| `/jank_light` | Pure static scan — no browser, no setup, instant |
| `/jank_test` | Surgical — type a feature/flow after the command |
| `/jank_explore` | 5 user-style agents act in your app |
| `/jank_cloud` | Free hosted audit — type a URL after the command |
| `/jank_clean` | Reap zombie Chrome from a cancelled run |

## Uninstall

```bash
rm -f ~/.claude/commands/jank*.md
rm -rf ~/.claude/plugins/jank-plugin
```

Then ⌘Q + relaunch Claude Desktop.

## Layout

```
plugins/jank-plugin/
  .claude-plugin/plugin.json    plugin manifest (read by Claude Code)
  .mcp.json                     MCP server registration (jank-ai + playwright)
  commands/<name>.md            slash-command shims (one per command)
  server/index.js               bundled MCP server (~685 KB, minified)
  mcp/playwright-launch.mjs     playwright helper for live-browser commands
  scripts/verify-install.sh     post-install sanity check
```

The slash-command bodies (`commands/<name>.md`) are thin shims. They tell
Claude to call `mcp__jank-ai__jank_get_playbook(name="...")` and follow
what comes back. The actual playbook content lives inside the bundled,
minified `server/index.js` — same protection level as the rest of the
server source.

## License

Proprietary. © testers.ai / jank.ai.
