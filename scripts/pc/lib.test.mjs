import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_UPDATE_TASK, BRANCH, autoUpdateCreateArgs, changedPaths, classifyChanges, dependenciesChanged,
  isEgdeskOnlyChange, stripEgdeskBlocks,
} from "./lib.mjs";

test("follows master", () => {
  assert.equal(BRANCH, "master");
});

test("EGDesk files and CLAUDE.md are preserved; other edits (incl. src/proxy.ts) stop the update", () => {
  const porcelain = [
    " M package.json", " M next.config.ts", " M egdesk-helpers.ts", " M src/lib/api.ts", " M CLAUDE.md",
    " M src/proxy.ts", "M  src/app/page.tsx", "R  old.ts -> src/new.ts", "",
  ].join("\n");
  assert.deepEqual(changedPaths(porcelain).slice(-2), ["src/app/page.tsx", "src/new.ts"]);
  assert.deepEqual(classifyChanges(porcelain), {
    preserve: ["package.json", "next.config.ts", "egdesk-helpers.ts", "src/lib/api.ts", "CLAUDE.md"],
    other: ["src/proxy.ts", "src/app/page.tsx", "src/new.ts"],
  });
  assert.deepEqual(classifyChanges(""), { preserve: [], other: [] });
});

test("documents changed only inside EGDesk blocks count as EGDesk changes", () => {
  const committed = "# Doc\n\nbody\n";
  const withBlock = "# Doc\r\n\r\nbody\r\n\r\n<!-- BEGIN:egdesk-dev-context -->\r\nport 4004\r\n<!-- END:egdesk-dev-context -->\r\n";
  assert.equal(stripEgdeskBlocks(withBlock), "# Doc\n\nbody");
  assert.equal(isEgdeskOnlyChange(committed, withBlock), true);
  assert.equal(isEgdeskOnlyChange(committed, withBlock.replace("body", "edited body")), false);
  assert.equal(isEgdeskOnlyChange(committed, committed), false);
});

test("dependency changes are detected", () => {
  assert.equal(dependenciesChanged(["src/app/page.tsx", "package-lock.json"]), true);
  assert.equal(dependenciesChanged(["src/app/page.tsx"]), false);
});

test("auto update task runs the hidden launcher from the project folder", () => {
  const args = autoUpdateCreateArgs("C:\\dev\\egdesksms-032\\");
  assert.deepEqual(args.slice(0, 3), ["/Create", "/TN", AUTO_UPDATE_TASK]);
  assert.equal(args[args.indexOf("/TR") + 1], 'wscript.exe "C:\\dev\\egdesksms-032\\scripts\\pc\\update-hidden.vbs"');
  assert.equal(args[args.indexOf("/MO") + 1], "10");
});
