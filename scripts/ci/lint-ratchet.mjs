#!/usr/bin/env node
/**
 * ESLint 래칫: 파일별 ESLint 오류 개수가 기준값(.github/eslint-baseline.json)보다 늘면 실패한다.
 * 기존 코드에 오류가 많아(도입 시점 400개 이상) 0 으로 막을 수 없으므로, "새 코드가 오류를
 * 늘리지 않는다"를 보장한다. 이지데스크가 생성하는 파일은 검사하지 않는다.
 *
 *   node scripts/ci/lint-ratchet.mjs            검사
 *   node scripts/ci/lint-ratchet.mjs --update   현재 개수로 기준값 갱신(오류를 줄였을 때)
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

const baselineFile = ".github/eslint-baseline.json";
const EGDESK_GENERATED = ["egdesk-helpers.ts", "egdesk.config.ts"];

const args = ["eslint", ".", "--format", "json", ...EGDESK_GENERATED.flatMap((f) => ["--ignore-pattern", f])];
const run = spawnSync("npx", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, shell: process.platform === "win32" });
let results;
try {
  results = JSON.parse(run.stdout);
} catch {
  console.error("ESLint 결과를 읽지 못했습니다.\n" + (run.stderr || run.stdout).slice(0, 4000));
  process.exit(2);
}

const current = {};
for (const file of results) {
  if (file.errorCount > 0) current[relative(process.cwd(), file.filePath).split("\\").join("/")] = file.errorCount;
}
const total = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

if (process.argv.includes("--update")) {
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselineFile, JSON.stringify({ total: total(current), files: sorted }, null, 2) + "\n");
  console.log(`기준값을 저장했습니다: 오류 ${total(current)}개, 파일 ${Object.keys(current).length}개`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselineFile, "utf8")).files ?? {};
const worse = Object.keys(current).filter((file) => current[file] > (baseline[file] ?? 0));
console.log(`ESLint 오류 ${total(current)}개 (기준 ${total(baseline)}개)`);

if (worse.length > 0) {
  console.error("\n오류가 늘어난 파일이 있습니다. 새로 생긴 오류를 고쳐 주세요:");
  for (const file of worse) {
    console.error(`\n${file}: ${baseline[file] ?? 0}개 → ${current[file]}개`);
    const entry = results.find((r) => relative(process.cwd(), r.filePath).split("\\").join("/") === file);
    for (const m of entry.messages.filter((x) => x.severity === 2)) {
      console.error(`  ${m.line}:${m.column}  ${m.ruleId ?? ""}  ${m.message}`);
    }
  }
  process.exit(1);
}
if (total(current) < total(baseline)) {
  console.log("오류가 줄었습니다. 'node scripts/ci/lint-ratchet.mjs --update' 로 기준값을 낮춰 함께 커밋하세요.");
}
