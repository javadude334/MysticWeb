const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function load(name) {
  const filename = path.resolve(__dirname, "../src/lib/mystic", name + ".ts");
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = m.require.bind(m);
  m.require = id => id === "./acs-candidate" ? load("acs-candidate") : original(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return m.exports;
}
const { evaluateVerifiedReadAcs } = load("acs-policy");
const verified = () => ({
  securityLevel: 20, memberGroupIds: [3], echoArea: true,
  areaVisible: true, groupVisible: true, privateOrPersonal: false,
});
test("verified ACS requires independent group membership and both security checks", () => {
  assert.deepEqual(evaluateVerifiedReadAcs("G3S10", "G3S20", verified()), { allowed: true, groupId: 3 });
  assert.equal(evaluateVerifiedReadAcs("G3S10", "G3S21", verified()).allowed, false);
  assert.equal(evaluateVerifiedReadAcs("G3S10", "G3S20", { ...verified(), memberGroupIds: [4] }).allowed, false);
  assert.equal(evaluateVerifiedReadAcs("G3S10", "G4S20", verified()).allowed, false);
});
test("verified ACS denies unverified context and unsupported expressions", () => {
  for (const change of [
    { echoArea: false }, { areaVisible: false }, { groupVisible: false },
    { privateOrPersonal: true }, { memberGroupIds: [] }, { securityLevel: -1 },
    { memberGroupIds: [0] }, { memberGroupIds: null },
  ]) assert.equal(evaluateVerifiedReadAcs("G3S10", "G3S20", { ...verified(), ...change }).allowed, false);
  for (const expression of ["", "G3|G4", "G3&S10", "G3G4", "G3S999", "%"]) {
    assert.equal(evaluateVerifiedReadAcs(expression, "G3S20", verified()).allowed, false);
  }
});
