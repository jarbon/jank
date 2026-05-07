#!/usr/bin/env node
// register-mcp.js — Add jank-ai to Claude Desktop's claude_desktop_config.json.
//
// Why this script exists: dropping plugin files into ~/.claude/plugins/ is
// not enough on current Claude Desktop builds — the embedded `.mcp.json`
// inside the plugin isn't auto-discovered. Until that's fixed upstream,
// the install also has to register the MCP server in the global config.
//
// Idempotent: safe to re-run after upgrading the plugin (the path it
// points at is stable: ~/.claude/plugins/jank-plugin/server/index.js).
// Skips silently if the entry already exists with the same path; updates
// the path if the entry exists but points elsewhere.
//
// Usage (run AFTER copying the plugin into ~/.claude/plugins/):
//   node ~/.claude/plugins/jank-plugin/scripts/register-mcp.js
//
// Exit codes:
//   0 — success (registered, updated, or already present)
//   1 — config file unreadable / unwritable / invalid JSON

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Locate Claude Desktop's config file. macOS for now; Windows/Linux paths
// extend this when we support those platforms.
function configPath() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"),
      "Claude", "claude_desktop_config.json");
  }
  // Linux fallback — Anthropic hasn't shipped Linux Claude Desktop yet,
  // but be ready for it. ~/.config/Claude/ is the XDG-style guess.
  return path.join(home, ".config", "Claude", "claude_desktop_config.json");
}

// Path to the bundled MCP server. Stable across versions because the
// plugin is always installed at ~/.claude/plugins/jank-plugin/.
function serverPath() {
  return path.join(os.homedir(), ".claude", "plugins", "jank-plugin", "server", "index.js");
}

const cfgFile = configPath();
const srvFile = serverPath();

// Sanity: the bundled server must exist before we register a path that
// points at it. Otherwise we'd register a dead path that crashes Claude
// Desktop's MCP client at boot.
if (!fs.existsSync(srvFile)) {
  console.error(`✗ Bundled MCP server not found at:\n  ${srvFile}\n`);
  console.error("  Run the plugin install first, then re-run this script.");
  process.exit(1);
}

let config;
let configExisted = false;

if (fs.existsSync(cfgFile)) {
  configExisted = true;
  let raw;
  try { raw = fs.readFileSync(cfgFile, "utf8"); }
  catch (e) {
    console.error(`✗ Could not read ${cfgFile}: ${e.message}`);
    process.exit(1);
  }
  try { config = JSON.parse(raw); }
  catch (e) {
    console.error(`✗ ${cfgFile} is not valid JSON: ${e.message}`);
    console.error("  Fix the JSON manually, then re-run this script.");
    process.exit(1);
  }
} else {
  // Fresh Claude Desktop install — config doesn't exist yet. We'll
  // create it. Make sure the parent dir exists too.
  config = {};
  try { fs.mkdirSync(path.dirname(cfgFile), { recursive: true }); } catch {}
}

config.mcpServers = config.mcpServers || {};

const existing = config.mcpServers["jank-ai"];
const newEntry = {
  command: "node",
  args: [srvFile],
};

let action;
if (!existing) {
  config.mcpServers["jank-ai"] = newEntry;
  action = "added";
} else if (
  existing.command === "node" &&
  Array.isArray(existing.args) &&
  existing.args[0] === srvFile
) {
  // Already registered with the right path — nothing to do.
  console.log(`✓ jank-ai already registered (path matches: ${srvFile})`);
  process.exit(0);
} else {
  // Same name, different path — update it. Preserve any extra fields
  // (env vars, etc.) the user added by hand.
  config.mcpServers["jank-ai"] = { ...existing, ...newEntry };
  action = "updated";
}

// Backup before write — only if the original config actually existed.
if (configExisted) {
  const bak = `${cfgFile}.pre-jank-register.bak`;
  try { fs.copyFileSync(cfgFile, bak); } catch (e) {
    console.error(`✗ Could not write backup to ${bak}: ${e.message}`);
    process.exit(1);
  }
}

try {
  fs.writeFileSync(cfgFile, JSON.stringify(config, null, 2) + "\n");
} catch (e) {
  console.error(`✗ Could not write ${cfgFile}: ${e.message}`);
  process.exit(1);
}

console.log(`✓ jank-ai ${action} in ${cfgFile}`);
console.log(`  → ${srvFile}`);
console.log("");
console.log("Next: ⌘Q Claude Desktop fully (not just close window) and relaunch.");
console.log("Then in the Code tab, type / to see the six jank slash commands.");
