const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/lib/mystic/packed-pointer-plan.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(compiled, filename);
const { planPackedPointer } = mod.exports;
const id = n => n.toString(16).padStart(64, "0");
const messages = (...entries) => entries.map(([number, identity]) => ({ number, identity: id(identity) }));
test("preserves read threshold after verified renumbering", () => {
  assert.deepEqual(planPackedPointer(messages([10,1],[11,2],[12,3]),
    messages([1,1],[2,2],[3,3]),11), {
    status:"safe_candidate",reason:"identity_preserved",previous:11,proposed:2,
  });
});
test("does not turn unread messages into read messages", () => {
  assert.equal(planPackedPointer(messages([10,1],[11,2],[12,3]),
    messages([1,3],[2,1],[3,2]),11).reason,"noncontiguous_read_state");
});
test("blocks missing identity without verified deletion proof", () => {
  assert.equal(planPackedPointer(messages([10,1],[11,2]),
    messages([1,1]),11).reason,"missing_identity_requires_deletion_proof");
});
test("blocks unknown identities and duplicate identities", () => {
  assert.equal(planPackedPointer(messages([10,1]),messages([1,2]),10).status,"blocked");
  assert.equal(planPackedPointer(messages([10,1]),messages([1,1],[2,1]),10).status,"blocked");
});
test("does not infer state from an empty before snapshot", () => {
  assert.equal(planPackedPointer([],[],0).status,"blocked");
});
