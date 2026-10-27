/* Tests run without connecting to the live BBS or publishing its contents. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/mystic/config.ts");
const source = fs.readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = mod.require.bind(mod);
mod.require = (id) => (id === "server-only" ? {} : originalRequire(id));
mod._compile(compiled, filename);
const { parseMysticGroups, parseMysticAreas } = mod.exports;

function putString(buffer, offset, capacity, text) {
  const bytes = Buffer.from(text, "latin1");
  assert.ok(bytes.length <= capacity);
  buffer[offset] = bytes.length;
  bytes.copy(buffer, offset + 1);
}

function group(id, name) {
  const b = Buffer.alloc(206);
  b.writeUInt32LE(id, 0);
  putString(b, 4, 60, name);
  return b;
}

function area(id, name, base, security) {
  const b = Buffer.alloc(768);
  b.writeUInt16LE(id, 0);
  putString(b, 2, 60, name);
  putString(b, 138, 40, base);
  [263, 294, 325, 356].forEach((offset, i) => putString(b, offset, 30, security[i]));
  return b;
}

test("parses group records and non-sequential IDs", () => {
  assert.deepEqual(parseMysticGroups(Buffer.concat([group(6, "Netmail"), group(1, "fsxNet")])), [
    { id: 6, name: "Netmail" },
    { id: 1, name: "fsxNet" },
  ]);
});

test("parses area metadata but does not interpret security as authorization", () => {
  const result = parseMysticAreas(area(467, "Amateur Radio", "ham_radio", [
    "s10g7", "s10g7", "s20g7", "s255g7",
  ]));
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 467);
  assert.equal(result[0].jamBase, "ham_radio");
  assert.equal(result[0].inferredGroupId, 7);
  assert.deepEqual(result[0].security, ["s10g7", "s10g7", "s20g7", "s255g7"]);
});

test("does not guess a group when none or multiple are referenced", () => {
  const records = Buffer.concat([
    area(1, "E-mail", "email", ["%", "s10", "s10", "s255"]),
    area(2, "Mixed", "mixed", ["s10g1", "s10g2", "s20", "s255"]),
  ]);
  assert.deepEqual(parseMysticAreas(records).map((x) => x.inferredGroupId), [null, null]);
});

test("rejects truncated records and invalid string lengths", () => {
  assert.throws(() => parseMysticGroups(Buffer.alloc(205)), /size/);
  assert.throws(() => parseMysticAreas(Buffer.alloc(767)), /size/);
  const bad = group(1, "ok");
  bad[4] = 61;
  assert.throws(() => parseMysticGroups(bad), /length/);
});

test("rejects duplicate identifiers", () => {
  assert.throws(() => parseMysticGroups(Buffer.concat([group(1, "a"), group(1, "b")])), /Duplicate/);
  const s = ["s10g1", "s10g1", "s20g1", "s255g1"];
  assert.throws(() => parseMysticAreas(Buffer.concat([area(2, "a", "a", s), area(2, "b", "b", s)])), /Duplicate/);
});
