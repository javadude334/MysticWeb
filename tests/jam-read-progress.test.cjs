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
  const originalRequire = mod.require.bind(mod);
  mod.require = id => id === "./jam-last-read" ? load("jam-last-read.ts") : originalRequire(id);
  mod._compile(compiled, filename);
  return mod.exports;
}
const { inspectJamReadProgress } = load("jam-read-progress.ts");
function pointer(id, last, high = last) {
  const b = Buffer.alloc(16);
  b.writeUInt32LE(123, 0);
  b.writeUInt32LE(id, 4);
  b.writeUInt32LE(last, 8);
  b.writeUInt32LE(high, 12);
  return b;
}
function index(count) {
  const b = Buffer.alloc(count * 8);
  for (let i = 0; i < count; i++) b.writeUInt32LE(i * 100, i * 8 + 4);
  return b;
}
test("hnet_space observed 134 index entries and pointer 81 yield candidate 53", () => {
  const p = inspectJamReadProgress(index(134), pointer(5, 81), 5);
  assert.equal(p.indexedEntries, 134);
  assert.equal(p.candidateNewCount, 53);
  assert.equal(p.exact, false);
});
test("unknown user does not imply zero read messages", () => {
  assert.equal(inspectJamReadProgress(index(2), pointer(5, 1), 7).candidateNewCount, null);
});
test("deleted index entry prevents misleading unread count", () => {
  const b = index(3);
  b.writeUInt32LE(0xffffffff, 12);
  assert.equal(inspectJamReadProgress(b, pointer(5, 1), 5).candidateNewCount, null);
});
test("out-of-range pointer and truncated index cannot produce counts", () => {
  assert.equal(inspectJamReadProgress(index(3), pointer(5, 20), 5).candidateNewCount, null);
  assert.throws(() => inspectJamReadProgress(Buffer.alloc(7), pointer(5, 1), 5), /index/);
});
test("diagnostic leaves both input buffers unchanged", () => {
  const i = index(4), p = pointer(5, 2), a = Buffer.from(i), b = Buffer.from(p);
  inspectJamReadProgress(i, p, 5);
  assert.deepEqual(i, a);
  assert.deepEqual(p, b);
});
