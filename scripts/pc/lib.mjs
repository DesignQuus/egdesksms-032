/**
 * Pure helpers for scripts/pc/update.mjs (kept separate so they can be tested).
 * Ported from the inprint repository's PC updater.
 */

/** Branch the PC follows. */
export const BRANCH = "master";

/** Tracked files EGDesk rewrites on the PC. They are kept as-is across updates and never committed. */
export const EGDESK_FILES = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "egdesk-helpers.ts",
  "egdesk.config.ts",
  "src/lib/api.ts",
  "EGDESK-README.md",
  "AGENTS.md",
  ".agents/rules/egdesk-dev-context.md",
];
// src/proxy.ts is NOT listed on purpose: it carries this repo's security checks. If EGDesk
// regenerates it on the PC, the update stops and logs it instead of silently keeping that copy.

/** Paths from `git status --porcelain --untracked-files=no` output (renames use the new path). */
export function changedPaths(porcelain) {
  return porcelain
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 3)
    .map((line) => {
      const path = line.slice(3).trim();
      const arrow = path.indexOf(" -> ");
      return (arrow >= 0 ? path.slice(arrow + 4) : path).replace(/^"|"$/g, "");
    });
}

/**
 * Agent instruction files that tools on the PC (EGDesk, local AI sessions) append notes to.
 * Local edits are kept as they are (put aside and restored, never committed or overwritten),
 * so they never block an update.
 */
export const PC_NOTE_FILES = ["CLAUDE.md"];

/** Splits local changes into files preserved automatically and anything else (stops the update). */
export function classifyChanges(porcelain) {
  const preserve = [];
  const other = [];
  for (const path of changedPaths(porcelain)) {
    (EGDESK_FILES.includes(path) || PC_NOTE_FILES.includes(path) ? preserve : other).push(path);
  }
  return { preserve, other };
}

/**
 * EGDesk also writes its dev-context block (<!-- BEGIN:egdesk... --> ... <!-- END:egdesk... -->)
 * into instruction files such as CLAUDE.md. Removes those blocks so a file whose only local
 * change is that block can be preserved like the other EGDesk files.
 */
export function stripEgdeskBlocks(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/<!--\s*BEGIN:egdesk[^>]*-->[\s\S]*?<!--\s*END:egdesk[^>]*-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when the working copy differs from the committed file only inside EGDesk blocks. */
export function isEgdeskOnlyChange(committed, working) {
  if (committed === working) return false;
  if (!/BEGIN:egdesk/.test(working) && !/BEGIN:egdesk/.test(committed)) return false;
  return stripEgdeskBlocks(committed) === stripEgdeskBlocks(working);
}

/** Folder under %LOCALAPPDATA% for the auto-update log. */
export const LOG_FOLDER = "EgdeskSms";

/** True when the pulled commits changed dependencies, so `npm install` is needed. */
export function dependenciesChanged(changedFiles) {
  return changedFiles.some((file) => file === "package.json" || file === "package-lock.json");
}

/** Windows Task Scheduler task used by autoupdate-on.cmd / autoupdate-off.cmd. */
export const AUTO_UPDATE_TASK = "EGDesk SMS Auto Update";
export const AUTO_UPDATE_INTERVAL_MINUTES = 10;

/** `schtasks` arguments that run scripts\pc\update-hidden.vbs (no window) every few minutes. */
export function autoUpdateCreateArgs(root) {
  const vbs = `${root.replace(/[\\/]+$/, "")}\\scripts\\pc\\update-hidden.vbs`;
  return [
    "/Create", "/TN", AUTO_UPDATE_TASK,
    "/SC", "MINUTE", "/MO", String(AUTO_UPDATE_INTERVAL_MINUTES),
    "/TR", `wscript.exe "${vbs}"`,
    "/F",
  ];
}

