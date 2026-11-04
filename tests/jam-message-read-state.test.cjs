const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function load(relative) {
  const filename = path.resolve(__dirname, "../src/lib/mystic", relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === "./jam-last-read" ? load("jam-last-read.ts") : original(id);
  mod._compile(compiled, filename);
  return mod.exports;
}
const { getJamMessageReadState, classifyJamMessage } = load("jam-message-read-state.ts");
function record(id, last, high) {
  const b = Buffer.alloc(16);
  b.writeUInt32LE(123, 0);
  b.writeUInt32LE(id, 4);
  b.writeUInt32LE(last, 8);
  b.writeUInt32LE(high, 12);
  return b;
}
test("classifies hnet_space pointer 81 without mutating the input", () => {
  const input = record(5, 81, 81), copy = Buffer.from(input);
  const state = getJamMessageReadState(input, 5);
  assert.equal(classifyJamMessage(state, 81), "at-or-before-pointer");
  assert.equal(classifyJamMessage(state, 82), "after-pointer");
  assert.equal(classifyJamMessage(state, 134), "after-pointer");
  assert.deepEqual(input, copy);
});
test("uses the authenticated numeric user ID rather than record position", () => {
  const input = Buffer.concat([record(7, 100, 100), record(5, 81, 90)]);
  assert.equal(getJamMessageReadState(input, 5).lastReadMsg, 81);
  assert.equal(getJamMessageReadState(input, 7).lastReadMsg, 100);
});
test("missing user and inconsistent pointers remain unknown", () => {
  assert.equal(getJamMessageReadState(record(7, 2, 2), 5), null);
  assert.equal(getJamMessageReadState(record(5, 10, 9), 5), null);
  assert.equal(classifyJamMessage(null, 42), "unknown");
});
test("invalid message numbers cannot be classified", () => {
  const state = getJamMessageReadState(record(5, 3, 3), 5);
  for (const number of [0, -1, 1.5, NaN, 0x100000000])
    assert.equal(classifyJamMessage(state, number), "unknown");
});
test("truncated or duplicate pointer records are rejected", () => {
  assert.throws(() => getJamMessageReadState(Buffer.alloc(7), 5));
  assert.throws(() => getJamMessageReadState(Buffer.concat([record(5, 1, 1), record(5, 2, 2)]), 5));
});
