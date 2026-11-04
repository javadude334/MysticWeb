const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/lib/mystic/read-state.ts");
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m.require = id => id === "server-only" ? {} : require(id);
m._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { validateReadWrite, monotonicReadPointer, UnconfiguredMysticReadStateWriter, NativeReadStateUnavailable } = m.exports;
const identity = { instance: "mystic_sandbox", userId: 5 };

test("validates user and area identity before native pointer writes", () => {
  assert.doesNotThrow(() => validateReadWrite(identity, 23, 99));
  for (const value of [0, -1, 1.5, NaN, 0x100000000]) {
    assert.throws(() => validateReadWrite(identity, 23, value), RangeError);
  }
  assert.throws(() => validateReadWrite({ ...identity, userId: 0 }, 23, 99), RangeError);
  assert.throws(() => validateReadWrite(identity, 0, 99), RangeError);
});
test("read pointers never rewind", () => {
  assert.equal(monotonicReadPointer(100, 50), 100);
  assert.equal(monotonicReadPointer(100, 101), 101);
  assert.equal(monotonicReadPointer(0, 1), 1);
  assert.throws(() => monotonicReadPointer(-1, 2), RangeError);
});
test("unconfigured native writer fails closed without modifying Mystic files", async () => {
  const writer = new UnconfiguredMysticReadStateWriter();
  await assert.rejects(writer.read(identity, 23), NativeReadStateUnavailable);
  await assert.rejects(writer.markRead(identity, 23, 99), NativeReadStateUnavailable);
});
