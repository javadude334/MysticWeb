const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/mystic/jam-last-read.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(compiled, filename);
const { parseJamLastRead, findJamLastRead } = mod.exports;

function record(crc, userId, last, high) {
  const b = Buffer.alloc(16);
  [crc, userId, last, high].forEach((n, i) => b.writeUInt32LE(n, i * 4));
  return b;
}

test("decodes standard JAM last-read record fields", () => {
  assert.deepEqual(parseJamLastRead(record(535651131, 5, 1, 1)), [
    { userCrc: 535651131, userId: 5, lastReadMsg: 1, highReadMsg: 1 },
  ]);
});

test("looks up individual users without confusing record index with user ID", () => {
  const records = parseJamLastRead(Buffer.concat([
    record(535651131, 5, 1, 1), record(1938240785, 7, 0, 0),
  ]));
  assert.equal(findJamLastRead(records, 7)?.lastReadMsg, 0);
  assert.equal(findJamLastRead(records, 1), undefined);
  assert.equal(findJamLastRead(records, 0), undefined);
});

test("empty last-read file is valid, truncated records fail closed", () => {
  assert.deepEqual(parseJamLastRead(Buffer.alloc(0)), []);
  assert.throws(() => parseJamLastRead(Buffer.alloc(15)), /size/);
  assert.throws(() => parseJamLastRead(Buffer.alloc(17)), /size/);
});

test("rejects duplicate or invalid user identifiers", () => {
  assert.throws(() => parseJamLastRead(record(0, 0, 0, 0)), /identifier/);
  assert.throws(() => parseJamLastRead(Buffer.concat([
    record(1, 5, 0, 0), record(2, 5, 0, 0),
  ])), /identifier/);
});

test("parsing does not mutate the input bytes", () => {
  const bytes = record(1, 5, 4, 9);
  const original = Buffer.from(bytes);
  parseJamLastRead(bytes);
  assert.deepEqual(bytes, original);
});
