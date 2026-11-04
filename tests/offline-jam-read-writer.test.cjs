const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const source = path.resolve(__dirname, "../src/lib/mystic/offline-jam-read-writer.ts");
const mod = new Module(source, module);
mod.filename = source;
mod.paths = Module._nodeModulePaths(path.dirname(source));
mod.require = id => {
  if (id === "server-only") return {};
  if (id === "./jam-last-read") {
    const file = path.resolve(__dirname, "../src/lib/mystic/jam-last-read.ts");
    const child = new Module(file, mod);
    child.filename = file;
    child.paths = Module._nodeModulePaths(path.dirname(file));
    child._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, file);
    return child.exports;
  }
  return require(id);
};
mod._compile(ts.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, source);
const { advanceOfflineSandboxJamPointer: advance } = mod.exports;
function record(userId, last, high) {
  const b = Buffer.alloc(16);
  b.writeUInt32LE(12345, 0); b.writeUInt32LE(userId, 4);
  b.writeUInt32LE(last, 8); b.writeUInt32LE(high, 12);
  return b;
}
test("offline pointer writer is disabled without explicit opt-in", async () => {
  await assert.rejects(advance("C:/sandbox", "C:/sandbox/msgs", "test", 5, 3, true), /disabled/);
});
test("offline sandbox writer advances only contiguous current user, never jumps", async () => {
  const previous = process.env.MYSTICWEB_OFFLINE_JLR_TEST;
  const previousNodeEnv = process.env.NODE_ENV;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mystic-jlr-offline-"));
  const jam = path.join(root, "msgs");
  fs.mkdirSync(jam);
  const filename = path.join(jam, "test.jlr");
  const initial = Buffer.concat([record(5, 3, 8), record(7, 2, 2)]);
  fs.writeFileSync(filename, initial);
  try {
    process.env.NODE_ENV = "development";
    process.env.MYSTICWEB_OFFLINE_JLR_TEST = "I_HAVE_STOPPED_MYSTIC";
    assert.equal(await advance(root, jam, "test", 5, 5, true), "gap-or-missing");
    assert.deepEqual(fs.readFileSync(filename), initial);
    assert.equal(await advance(root, jam, "test", 5, 4, true), "advanced");
    const updated = fs.readFileSync(filename);
    assert.equal(updated.readUInt32LE(8), 4);
    assert.equal(updated.readUInt32LE(12), 8);
    assert.deepEqual(updated.subarray(16), initial.subarray(16));
    assert.equal(await advance(root, jam, "test", 5, 4, true), "already-read");
    assert.equal(await advance(root, jam, "test", 99, 1, true), "gap-or-missing");
    assert.equal(fs.existsSync(filename + ".mysticweb-offline.lock"), false);
  } finally {
    if (previous === undefined) delete process.env.MYSTICWEB_OFFLINE_JLR_TEST;
    else process.env.MYSTICWEB_OFFLINE_JLR_TEST = previous;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
