#!/usr/bin/env node
/**
 * PC update in one step (replaces: git stash -> git pull -> git stash pop).
 *
 *   update.cmd                (double-click, or run in PowerShell from the project folder)
 *   node scripts/pc/update.mjs [--no-install] [--auto]
 *
 * --auto: used by the scheduled task (autoupdate-on.cmd). Writes one short line
 * when there is nothing to do, and a timestamp so the log is readable.
 *
 * - Only fast-forwards `master` from GitHub. Local commits or local edits to
 *   project files stop the update (nothing is overwritten).
 * - EGDesk's own tracked files (package.json, package-lock.json, ...) are put
 *   aside and restored exactly as they were. They are never committed.
 * - Runs `npm install` only when the pulled commits changed dependencies.
 * - Does not start, stop or touch EGDesk: press ■ → ▶ in EGDesk afterwards.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BRANCH, classifyChanges, dependenciesChanged, isEgdeskOnlyChange } from "./lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
process.chdir(root);
const skipInstall = process.argv.includes("--no-install");
const auto = process.argv.includes("--auto");
const windows = process.platform === "win32";

function git(args, { allowFail = false } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) stop(`git 을 실행할 수 없습니다: ${result.error.message}\nGit for Windows 가 설치되어 있는지 확인하세요.`);
  if (result.status !== 0 && !allowFail) stop(`git ${args.join(" ")} 실패\n${(result.stderr || result.stdout).trim()}`);
  // Only trailing whitespace: porcelain status lines start with a meaningful space (" M file").
  return { ok: result.status === 0, out: (result.stdout ?? "").trimEnd(), err: (result.stderr ?? "").trim() };
}

function say(message) {
  console.log(message);
}

function stop(message, code = 1) {
  console.error(`\n[중단]${auto ? ` ${stamp}` : ""} ${message}`);
  process.exit(code);
}

const stamp = new Date().toLocaleString("ko-KR", { hour12: false });
if (!auto) say("이지데스크 SMS PC 업데이트\n");

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
if (branch !== BRANCH) stop(`지금 브랜치가 '${branch}' 입니다. ${BRANCH} 에서만 자동 업데이트합니다.\n  git switch ${BRANCH}  후 다시 실행하세요.`);

if (!auto) say("1) GitHub 에서 최신 내용 확인…");
git(["fetch", "origin", BRANCH]);
const ahead = Number(git(["rev-list", "--count", `origin/${BRANCH}..HEAD`]).out);
const behind = Number(git(["rev-list", "--count", `HEAD..origin/${BRANCH}`]).out);
if (ahead > 0) stop(`이 PC 에만 있는 커밋이 ${ahead}개 있습니다. 덮어쓰지 않도록 멈춥니다.\n  git log origin/${BRANCH}..HEAD --oneline  으로 확인하세요.`);
if (behind === 0) {
  say(auto ? `${stamp} 최신 상태` : "   이미 최신입니다. 할 일이 없습니다.");
  process.exit(0);
}
if (auto) say(`\n===== ${stamp} 자동 업데이트 =====`);
say(`   새 변경 ${behind}개`);

const { preserve, other: changedOther } = classifyChanges(git(["status", "--porcelain", "--untracked-files=no"]).out);
// 이지데스크가 안내 블록(<!-- BEGIN:egdesk -->)만 넣은 문서(CLAUDE.md 등)도 이지데스크 파일로 보관한다.
const other = [];
for (const file of changedOther) {
  const committed = git(["show", `HEAD:${file}`], { allowFail: true });
  const working = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (committed.ok && working !== null && isEgdeskOnlyChange(committed.out, working.trimEnd())) preserve.push(file);
  else other.push(file);
}
if (other.length > 0) {
  const proxyNote = other.includes("src/proxy.ts")
    ? "  ※ src/proxy.ts 는 로그인·권한 검사가 들어 있는 파일입니다. 이지데스크가 다시 만들었다면\n" +
      "    보안 검사가 빠졌을 수 있으니 Claude 에게 확인을 요청하세요.\n"
    : "";
  stop(`이 PC 에서 고친 파일이 있어 멈춥니다(덮어쓰지 않음):\n${other.map((f) => `  - ${f}`).join("\n")}\n` +
    proxyNote + "  필요하면 커밋하거나 따로 보관한 뒤 다시 실행하세요.");
}

const oldHead = git(["rev-parse", "HEAD"]).out;
let stashed = false;
if (preserve.length > 0) {
  say(`2) 이지데스크 파일 잠시 보관: ${preserve.join(", ")}`);
  git(["stash", "push", "-m", `pc-update: 이지데스크 파일 보관 ${new Date().toISOString()}`, "--", ...preserve]);
  stashed = true;
} else {
  say("2) 보관할 이지데스크 파일 없음");
}

say("3) 최신 내용 받기…");
const merged = git(["merge", "--ff-only", `origin/${BRANCH}`], { allowFail: true });
if (!merged.ok) {
  if (stashed) git(["stash", "pop"], { allowFail: true });
  stop(`받기에 실패해 원래 상태로 되돌렸습니다.\n${merged.err || merged.out}`);
}
const newHead = git(["rev-parse", "HEAD"]).out;
const changed = git(["diff", "--name-only", oldHead, newHead]).out.split(/\r?\n/).filter(Boolean);

if (stashed) {
  say("4) 이지데스크 파일 되돌려 놓기…");
  const popped = git(["stash", "pop"], { allowFail: true });
  if (!popped.ok) {
    stop("이지데스크 파일을 되돌리다 충돌이 났습니다. 받은 내용은 적용됐고, 보관본은 stash 에 그대로 남아 있습니다.\n" +
      "  1) git status  로 충돌 파일을 확인합니다.\n" +
      "  2) 파일을 열어 이지데스크가 넣은 줄을 살려 저장합니다.\n" +
      "  3) 정리가 끝난 뒤에만  git stash drop  으로 보관본을 지웁니다.");
  }
} else {
  say("4) 되돌릴 파일 없음");
}

if (dependenciesChanged(changed) && !skipInstall) {
  say("5) 의존성이 바뀌어 npm install 실행…");
  const npm = spawnSync(windows ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund"], { stdio: "inherit", shell: windows });
  if (npm.status !== 0) stop("npm install 이 실패했습니다. 위 오류를 확인하세요. 코드는 이미 최신입니다.");
} else {
  say(`5) npm install ${dependenciesChanged(changed) ? "건너뜀(--no-install)" : "필요 없음"}`);
}

say("\n받은 변경:");
say(git(["log", "--oneline", "--no-decorate", "-n", "15", `${oldHead}..${newHead}`]).out.split(/\r?\n/).map((l) => `  ${l}`).join("\n"));
say("\n완료. 실행 중인 개발 서버(next dev)는 바뀐 코드를 감지해 자동으로 반영합니다.");
say("브라우저를 새로고침하세요. 의존성이 바뀌었으면(위 5번) 이지데스크에서 ■ → ▶ 를 누르세요.");
