const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { createHash, pbkdf2Sync } = require("node:crypto");
const ts = require("typescript");
const fs = require("node:fs");

function loadTs(file) {
  const filename = path.resolve(__dirname, "../src/lib/mystic", file + ".ts");
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const requireOriginal = m.require.bind(m);
  m.require = id => id === "server-only" ? {} :
    id === "./native-password" ? loadTs("native-password") : requireOriginal(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return m.exports;
}

const { verifyMysticPasswordRecord } = loadTs("native-password");
const { verifyMysticHandle } = loadTs("native-user-login");

function fixture({ id = 17, handle = "TestUser", password = "test-password", flags = 0 } = {}) {
  const record = Buffer.alloc(1536);
  record.writeUInt32LE(id, 0);
  record.writeUInt32LE(flags, 4);
  record[8] = 2;
  record.writeUInt32LE(1000, 9);
  Buffer.alloc(32, 0x42).copy(record, 13);
  const prehash = createHash("sha512").update(password, "utf8").digest();
  pbkdf2Sync(prehash, record.subarray(13, 45), 1000, 64, "sha512").copy(record, 45);
  prehash.fill(0);
  record[109] = handle.length;
  record.write(handle, 110, "ascii");
  return record;
}
function temporary(t, records) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mystic-native-login-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "users.dat");
  writeFileSync(filename, Buffer.concat(records));
  return filename;
}

test("method-2 native record accepts correct password and rejects incorrect password", () => {
  const record = fixture();
  assert.equal(verifyMysticPasswordRecord(record, "test-password"), true);
  assert.equal(verifyMysticPasswordRecord(record, "wrong"), false);
  record[8] = 1;
  assert.equal(verifyMysticPasswordRecord(record, "test-password"), false);
});

test("read-only lookup finds one handle with case-insensitive ASCII comparison", async t => {
  const filename = temporary(t, [fixture({ id: 17 }), fixture({ id: 18, handle: "Another" })]);
  assert.deepEqual(await verifyMysticHandle(filename, "testuser", "test-password"), { userId: 17 });
  assert.equal(await verifyMysticHandle(filename, "testuser", "wrong"), null);
  assert.equal(await verifyMysticHandle(filename, "missing", "test-password"), null);
});

test("locked, deleted and forced-change flags deny authentication", async t => {
  for (const flag of [0x1, 0x4, 0x400]) {
    const filename = temporary(t, [fixture({ flags: flag })]);
    assert.equal(await verifyMysticHandle(filename, "TestUser", "test-password"), null);
  }
});

test("duplicate handles, malformed records and invalid handle encodings fail closed", async t => {
  const duplicate = temporary(t, [fixture(), fixture({ id: 18, handle: "testuser" })]);
  assert.equal(await verifyMysticHandle(duplicate, "TestUser", "test-password"), null);
  const malformed = temporary(t, [Buffer.alloc(100)]);
  assert.equal(await verifyMysticHandle(malformed, "TestUser", "test-password"), null);
  const invalid = fixture();
  invalid[109] = 31;
  const filename = temporary(t, [invalid]);
  assert.equal(await verifyMysticHandle(filename, "TestUser", "test-password"), null);
});

test("read-only lookup rejects relative paths and path-like user input", async t => {
  const filename = temporary(t, [fixture()]);
  assert.equal(await verifyMysticHandle("users.dat", "TestUser", "test-password"), null);
  assert.equal(await verifyMysticHandle(filename, "Test/User", "test-password"), null);
  assert.equal(await verifyMysticHandle(filename, "TestUser", ""), null);
});
