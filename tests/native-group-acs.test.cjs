const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function load(relative) {
  const filename = path.resolve(__dirname, "../src/lib/mystic", relative);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = id => id === "server-only" ? {} :
    id === "./acs-candidate" ? load("acs-candidate.ts") :
    id === "./jam" ? { isJamBaseName: name => /^[a-zA-Z0-9_-]+$/.test(name) } : originalRequire(id);
  mod._compile(compiled, filename);
  return mod.exports;
}

const { MessageAccess, groupAccessAllowed } = load("message-access.ts");
const groups = [
  { id: 1, name: "Default Message Group", access: "" },
  { id: 3, name: "General Interest", access: "s10" },
  { id: 6, name: "SYSOP Only Stuff", access: "s255" },
];
const areas = [
  { id: 35, name: "Alabama Discussion", inferredGroupId: 3, jamBase: "alabama",
    security: ["s10g3", "s20g3", "s30g3", "s255"] },
  { id: 90, name: "Sysop Chat", inferredGroupId: 6, jamBase: "sysop",
    security: ["s255g6", "s255g6", "s255g6", "s255"] },
];

test("native group ACS permits blank, threshold and rejects unsupported", () => {
  assert.equal(groupAccessAllowed("", 0), true);
  assert.equal(groupAccessAllowed("s10", 10), true);
  assert.equal(groupAccessAllowed("s255", 20), false);
  assert.equal(groupAccessAllowed("s10|s255", 255), false);
});

test("Alabama list/read/post permissions remain independent", () => {
  const ten = new MessageAccess(groups, areas, 10);
  assert.equal(ten.getMessageAreas(3).some(a => a.id === 35), true);
  assert.equal(ten.getArea(35), undefined);
  assert.equal(ten.canPost(35), false);
  const twenty = new MessageAccess(groups, areas, 20);
  assert.equal(twenty.getArea(35)?.id, 35);
  assert.equal(twenty.canPost(35), false);
  const thirty = new MessageAccess(groups, areas, 30);
  assert.equal(thirty.canPost(35), true);
});

test("Sysop group and direct message access denied to lower security", () => {
  const twenty = new MessageAccess(groups, areas, 20);
  assert.equal(twenty.getGroups().some(g => g.id === 6), false);
  assert.equal(twenty.getArea(90), undefined);
  const sysop = new MessageAccess(groups, areas, 255);
  assert.equal(sysop.getArea(90)?.id, 90);
});
