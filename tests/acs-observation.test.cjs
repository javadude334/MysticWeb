const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/lib/mystic/acs-observation.ts");
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
const original = mod.require.bind(mod);
mod.require = id => id === "server-only" ? {} : original(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { inspectObservedAcs, nativeMessageAccessVerified } = mod.exports;
test("ACS inventory never grants permissions", () => {
  assert.deepEqual(inspectObservedAcs("s10g2"), { kind: "level-and-group-candidate", minimumLevel: 10, groupId: 2 });
  assert.deepEqual(inspectObservedAcs("s255g1"), { kind: "level-and-group-candidate", minimumLevel: 255, groupId: 1 });
  assert.deepEqual(inspectObservedAcs("s10"), { kind: "level-only-candidate", minimumLevel: 10 });
  assert.deepEqual(inspectObservedAcs(""), { kind: "blank" });
  for (const s of ["%", "s10|s20", "s10g0", "s256g1", "s10g4294967296", "S10G2", "s10g2 "])
    assert.deepEqual(inspectObservedAcs(s), { kind: "unsupported" });
  assert.equal(nativeMessageAccessVerified(), false);
});
