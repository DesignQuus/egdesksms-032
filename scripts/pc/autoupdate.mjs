#!/usr/bin/env node
/**
 * PC 자동 업데이트 켜기/끄기 (Windows 작업 스케줄러).
 *
 *   autoupdate-on.cmd   → node scripts/pc/autoupdate.mjs on
 *   autoupdate-off.cmd  → node scripts/pc/autoupdate.mjs off
 *   node scripts/pc/autoupdate.mjs status
 *
 * 켜면 10분마다 scripts/pc/update-hidden.vbs 가 창 없이 `update.mjs --auto` 를 실행한다.
 * 업데이트 규칙은 update.cmd 와 같다(master 만, 이지데스크 파일 보관·복원, PC 수정이 있으면 멈춤).
 * 기록: %LOCALAPPDATA%\EgdeskSms\autoupdate.log
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTO_UPDATE_INTERVAL_MINUTES, AUTO_UPDATE_TASK, BRANCH, LOG_FOLDER, autoUpdateCreateArgs } from "./lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
process.chdir(root);
const command = process.argv[2];
const logFile = join(process.env.LOCALAPPDATA ?? "%LOCALAPPDATA%", LOG_FOLDER, "autoupdate.log");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: !result.error && result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
}

function stop(message) {
  console.error(`[중단] ${message}`);
  process.exit(1);
}

if (process.platform !== "win32") stop("Windows PC 에서만 쓰는 기능입니다.");

if (command === "on") {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out;
  if (branch !== BRANCH) stop(`지금 브랜치가 '${branch}' 입니다. ${BRANCH} 에서만 켤 수 있습니다.\n  git switch ${BRANCH}  후 다시 실행하세요.`);
  const created = run("schtasks", autoUpdateCreateArgs(root));
  if (!created.ok) stop(`작업 스케줄러 등록에 실패했습니다.\n${created.out}`);
  run("schtasks", ["/Run", "/TN", AUTO_UPDATE_TASK]);
  console.log("자동 업데이트를 켰습니다.");
  console.log(`- ${AUTO_UPDATE_INTERVAL_MINUTES}분마다 GitHub master 를 확인해 새 내용이 있으면 창 없이 받아 옵니다(지금 한 번 실행).`);
  console.log("- 개발 서버(next dev)는 바뀐 코드를 자동으로 반영합니다. 브라우저만 새로고침하세요.");
  console.log(`- 기록: ${logFile}`);
  console.log("- 끄려면 autoupdate-off.cmd 를 실행하세요.");
} else if (command === "off") {
  const removed = run("schtasks", ["/Delete", "/TN", AUTO_UPDATE_TASK, "/F"]);
  console.log(removed.ok ? "자동 업데이트를 껐습니다. 수동 업데이트는 update.cmd 를 실행하세요." : "자동 업데이트가 이미 꺼져 있습니다.");
} else if (command === "status") {
  const query = run("schtasks", ["/Query", "/TN", AUTO_UPDATE_TASK]);
  console.log(query.ok ? `자동 업데이트: 켜짐 (${AUTO_UPDATE_INTERVAL_MINUTES}분마다)\n기록: ${logFile}` : "자동 업데이트: 꺼짐");
} else {
  stop("사용법: node scripts/pc/autoupdate.mjs on | off | status");
}
