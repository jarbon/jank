#!/usr/bin/env node
// playwright-launch.mjs
// Thin wrapper that starts @playwright/mcp in a Chrome profile chosen for
// /jank runs. Three modes — pick whichever fits the user's needs:
//
//   ┌─────────────┬───────────────┬─────────────┬──────────────────────────┐
//   │   mode      │ same logins   │ runs        │ when to use              │
//   │             │ as my normal  │ headless?   │                          │
//   │             │ Chrome?       │             │                          │
//   ├─────────────┼───────────────┼─────────────┼──────────────────────────┤
//   │ DEDICATED   │ no (separate) │ optional    │ default — safest         │
//   │  (default)  │               │             │                          │
//   │ SHARED      │ YES           │ YES (fast!) │ when you want speed +    │
//   │  PROFILE    │ (cookies,     │             │ logged-in staging /      │
//   │             │  cache,       │             │ SSO / extensions, with   │
//   │             │  extensions   │             │ no UI overhead. The      │
//   │             │  via 1-time   │             │ recommended power-user   │
//   │             │  setup)       │             │ mode.                    │
//   │ REAL        │ YES (live)    │ no — opens  │ legacy escape hatch.     │
//   │  PROFILE    │ — but window  │ in your     │ Hijacks foreground tab   │
//   │             │  hijack risk  │ active win  │ — only use deliberately. │
//   └─────────────┴───────────────┴─────────────┴──────────────────────────┘
//
// Profile selection (first-match wins):
//   1. JANK_CHROME_PROFILE_DIR                   — explicit override
//   2. JANK_USE_REAL_CHROME_PROFILE=1            — user's "Default" profile
//                                                  inside their normal Chrome
//                                                  data dir (legacy mode)
//   3. JANK_USE_SHARED_USER_DATA=1               — uses the user's REAL
//                                                  User Data dir but a
//                                                  DEDICATED profile sub-
//                                                  directory ("Jank Test"
//                                                  by default; override via
//                                                  JANK_CHROME_SUB_PROFILE).
//                                                  Headless-by-default. ✨
//                                                  This is the mode for
//                                                  fast headless tests with
//                                                  full real-Chrome context.
//   4. default                                   — ~/.jank/chrome-profile
//                                                  (fully isolated profile)
//
// Headless flag: --headless or JANK_HEADLESS=1 turns on Chrome's new
// headless mode (`--headless=new`, the modern non-deprecated headless).
// The SHARED-PROFILE mode enables headless by default unless you
// explicitly pass --no-headless or JANK_HEADLESS=0.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const home = os.homedir();
const plat = process.platform;

function realUserDataDir() {
  if (plat === "darwin") {
    return path.join(home, "Library", "Application Support", "Google", "Chrome");
  }
  if (plat === "win32") {
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return path.join(local, "Google", "Chrome", "User Data");
  }
  return path.join(home, ".config", "google-chrome");
}

function dedicatedJankProfileDir() {
  return path.join(home, ".jank", "chrome-profile");
}

const SHARED_SUB_PROFILE_DEFAULT = "Jank Test";

let profileDir;       // value passed to --user-data-dir
let subProfile;       // value passed to --profile-directory (optional)
let mode;
let headlessDefault = false;

const explicitArgs = process.argv.slice(2);
const userPassedHeadless = explicitArgs.some(
  (a) => a === "--headless" || a.startsWith("--headless=")
);
const userPassedNoHeadless = explicitArgs.includes("--no-headless");

if (process.env.JANK_CHROME_PROFILE_DIR) {
  profileDir = process.env.JANK_CHROME_PROFILE_DIR;
  mode = "explicit (JANK_CHROME_PROFILE_DIR)";
} else if (process.env.JANK_USE_REAL_CHROME_PROFILE === "1") {
  // LEGACY — points at the user's whole User Data dir + default profile.
  // High risk of window hijack if the user's Chrome is already running.
  profileDir = realUserDataDir();
  mode = "real-default (JANK_USE_REAL_CHROME_PROFILE=1 — ⚠ window-hijack risk)";
} else if (process.env.JANK_USE_SHARED_USER_DATA === "1") {
  // RECOMMENDED for power users — shares the User Data dir with your
  // normal Chrome but uses a DEDICATED profile sub-directory. Two Chrome
  // instances can coexist as long as they pick different profile sub-dirs.
  // Defaults to headless because the whole point is invisible-and-fast.
  profileDir = realUserDataDir();
  subProfile = process.env.JANK_CHROME_SUB_PROFILE || SHARED_SUB_PROFILE_DEFAULT;
  headlessDefault = true;
  mode = `shared-user-data (profile="${subProfile}", real cookies/extensions, headless)`;
} else {
  profileDir = dedicatedJankProfileDir();
  mode = "dedicated (persistent, fully isolated from user's Chrome)";
}

try { fs.mkdirSync(profileDir, { recursive: true }); } catch (_) {}

// First-run hint for the SHARED-PROFILE mode: if the sub-profile dir
// doesn't exist yet, tell the user how to seed it with their staging /
// SSO logins.
if (subProfile) {
  const subDir = path.join(profileDir, subProfile);
  if (!fs.existsSync(subDir)) {
    // Auto-create the sub-profile so users don't have to do the Chrome
    // avatar → Add dance manually. An empty directory inside the User
    // Data dir is treated by Chrome as a fresh profile — Playwright will
    // populate it with default settings on first launch.
    try { fs.mkdirSync(subDir, { recursive: true }); } catch (_) {}
    process.stderr.write(
      `[jank-plugin] auto-created sub-profile "${subProfile}" inside\n` +
      `              ${profileDir}\n` +
      `\n` +
      `   This sub-profile starts empty (no logged-in sessions). For tests\n` +
      `   that need authenticated state on staging / SSO sites, log in once\n` +
      `   per site in your real Chrome under the "${subProfile}" profile\n` +
      `   (avatar → switch profile → ${subProfile}). Cookies persist across\n` +
      `   future /jank runs.\n` +
      `\n` +
      `   Tests against public URLs (no login required) work immediately.\n\n`
    );
  }
}

const browser = process.env.JANK_PLAYWRIGHT_BROWSER || "chrome";

const baseArgs = [
  "-y",
  "@playwright/mcp@latest",
  "--browser", browser,
  "--user-data-dir", profileDir,
  // NOTE: older versions accepted `--isolated=false` here to prevent
  // attaching to an unrelated Chrome instance. Newer @playwright/mcp
  // dropped that flag — passing it crashes the server with
  // "error: unknown option '--isolated=false'". Persistent context is
  // the default behavior whenever --user-data-dir is set, which is
  // exactly what we want, so the flag is no longer needed.
];

// NOTE: older versions accepted `--browser-arg=--profile-directory=<sub>` as
// pass-through to Chromium. Newer @playwright/mcp dropped --browser-arg
// entirely (passing it crashes the server with "unknown option"). With
// no way to select a sub-profile from the CLI, we just point user-data-dir
// at the (parent) Chrome User Data dir; Playwright uses the "Default"
// profile inside it. If you need the "Jank Test" sub-profile specifically,
// set JANK_CHROME_PROFILE_DIR to its full path instead of using shared mode.
if (subProfile) {
  process.stderr.write(
    `[jank-plugin] note: --browser-arg=--profile-directory is no longer\n` +
    `              supported by @playwright/mcp. Using the Default profile\n` +
    `              inside ${profileDir} instead. If you need the\n` +
    `              "${subProfile}" sub-profile, point JANK_CHROME_PROFILE_DIR\n` +
    `              at its full path:\n` +
    `              JANK_CHROME_PROFILE_DIR="${path.join(profileDir, subProfile)}"\n`
  );
}

// file:// URLs like /jank t.html require --allow-unrestricted-file-access
// — by default @playwright/mcp blocks navigation to file:// to keep
// untrusted-page tools sandboxed inside the workspace. Jank's tests are
// initiated by the user, so always-on file access is the right tradeoff.
baseArgs.push("--allow-unrestricted-file-access");

// Apply headless default + user override.
const wantHeadless = userPassedNoHeadless
  ? false
  : userPassedHeadless
    ? true
    : (process.env.JANK_HEADLESS === "1" || headlessDefault);
if (wantHeadless && !userPassedHeadless) {
  // Chrome's modern headless mode — same renderer, no UI thread.
  baseArgs.push("--headless");
}

const args = baseArgs.concat(explicitArgs.filter((a) => a !== "--no-headless"));

process.stderr.write(
  `[jank-plugin] starting Playwright MCP\n` +
  `              browser=${browser}\n` +
  `              user-data-dir=${profileDir}\n` +
  `              profile-directory=${subProfile || "(none — uses Default)"}\n` +
  `              headless=${wantHeadless}\n` +
  `              mode=${mode}\n`
);

const npxBin = plat === "win32" ? "npx.cmd" : "npx";
const child = spawn(npxBin, args, {
  stdio: "inherit",
  env: process.env,
  shell: plat === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  process.stderr.write(
    `[jank-plugin] failed to spawn '${npxBin} ${args.join(" ")}': ${err.message}\n` +
    `              ensure Node.js + npm are installed and on PATH.\n`
  );
  process.exit(1);
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { try { child.kill(sig); } catch (_) {} });
}
