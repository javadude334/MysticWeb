const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const path = require("node:path");
const file = path.resolve(__dirname, "../src/lib/mystic/acs-candidate.ts");
const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const m = new Module(file, module);
m.filename = file;
m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(js, file);
const { parseAcsCandidate, inspectAreaAcs, candidateMeetsSecurityLevel } = m.exports;

test("recognizes the observed group and security candidate grammar", () => {
  assert.deepEqual(parseAcsCandidate("g3s20"), { supported: true, groupId: 3, minimumSecurity: 20 });
  assert.deepEqual(parseAcsCandidate("s20g4"), { supported: true, groupId: 4, minimumSecurity: 20 });
  assert.deepEqual(parseAcsCandidate("g5"), { supported: true, groupId: 5, minimumSecurity: 0 });
});
test("fails closed on unverified ACS syntax and missing group", () => {
  for (const expression of ["", "s20", "g3|g4", "g3!s20", "g3g4", "g0", "g3s999", "g3 s20", "g3s20s30", "g3%"]) {
    assert.equal(parseAcsCandidate(expression).supported, false, expression);
  }
});
test("requires matching list/read group references", () => {
  assert.deepEqual(inspectAreaAcs("g3", "g3s20"), { supported: true, groupId: 3, minimumSecurity: 20 });
  assert.equal(inspectAreaAcs("g3", "g4").supported, false);
  assert.equal(inspectAreaAcs("g3", "").supported, false);
});

test("security threshold diagnostic excludes restricted message areas", () => {
  assert.deepEqual(candidateMeetsSecurityLevel("s10g1", "s10g1", 20), { candidate: true, groupId: 1 });
  assert.deepEqual(candidateMeetsSecurityLevel("s255g1", "s255g1", 20), { candidate: false, groupId: null });
  assert.deepEqual(candidateMeetsSecurityLevel("%", "", 20), { candidate: false, groupId: null });
  assert.deepEqual(candidateMeetsSecurityLevel("g3", "g3", -1), { candidate: false, groupId: null });
});
