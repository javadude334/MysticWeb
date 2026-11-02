const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync, writeFileSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { createHash, pbkdf2Sync } = require("node:crypto");

function load(folder, name) {
  const filename = path.resolve(__dirname, "../src/lib", folder, name + ".ts");
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = m.require.bind(m);
  m.require = id => id === "server-only" ? {} :
    id === "./native-password" ? load("mystic", "native-password") :
    id === "../mystic/native-user-login" ? load("mystic", "native-user-login") :
    id === "../mystic/native-account-status" ? load("mystic", "native-account-status") :
    original(id);
  m._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return m.exports;
}
const { NativeFileProvider } = load("auth", "native-file-provider");
const { NativeAccess } = load("auth", "native");
test("file provider authenticates eligible accounts but denies area permission", async t => {
  const dir = mkdtempSync(path.join(tmpdir(), "mystic-file-provider-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "users.dat");
  const record = Buffer.alloc(1536);
  record.writeUInt32LE(2, 0);
  record[8] = 2;
  record.writeUInt32LE(1000, 9);
  Buffer.alloc(32, 0x51).copy(record, 13);
  const prehash = createHash("sha512").update("synthetic-secret").digest();
  pbkdf2Sync(prehash, record.subarray(13, 45), 1000, 64, "sha512").copy(record, 45);
  prehash.fill(0);
  record[109] = 9;
  record.write("javadude2", 110, "ascii");
  writeFileSync(filename, record);
  const provider = new NativeFileProvider(filename, "sandbox");
  const native = new NativeAccess(provider, "sandbox");
  assert.deepEqual(await native.authenticate("javadude2", "synthetic-secret"), { instance: "sandbox", userId: 2 });
  assert.equal(await native.authenticate("javadude2", "wrong"), null);
  assert.equal(await native.accountValid({ instance: "sandbox", userId: 2 }), true);
  await assert.rejects(native.readArea({ instance: "sandbox", userId: 2 }, 1, "a".repeat(64), async () => "should not read"));
  assert.deepEqual(readFileSync(filename), record);
});

test("provider account rechecks deny locked, deleted and forced-change accounts", async t => {
  const dir = mkdtempSync(path.join(tmpdir(), "mystic-account-recheck-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "users.dat");
  const record = Buffer.alloc(1536);
  record.writeUInt32LE(4, 0);
  record[1006] = 10;
  writeFileSync(filename, record);
  const provider = new NativeFileProvider(filename, "sandbox");
  const makeRequest = () => ({
    version: 1, nonce: "test-nonce", operation: "account", instance: "sandbox", userId: 4,
  });
  const options = { signal: new AbortController().signal };
  let reply = await provider.request(makeRequest(), options);
  assert.equal(reply.account.locked, false);
  assert.equal(reply.account.expired, false);
  const access = new NativeAccess(provider, "sandbox");
  assert.equal(await access.accountValid({ instance: "sandbox", userId: 4 }), true);
  // Security level is available in the native reader, but does not itself grant access.
  record.writeUInt32LE(0x00000001, 4);
  writeFileSync(filename, record);
  reply = await provider.request(makeRequest(), options);
  assert.equal(reply, null);
  assert.equal(await access.accountValid({ instance: "sandbox", userId: 4 }), false);
  record.writeUInt32LE(0x00000400, 4);
  writeFileSync(filename, record);
  reply = await provider.request(makeRequest(), options);
  assert.equal(reply, null);
  assert.equal(await access.accountValid({ instance: "sandbox", userId: 4 }), false);
  record.writeUInt32LE(0x00000004, 4);
  writeFileSync(filename, record);
  assert.equal(await provider.request(makeRequest(), options), null);
  assert.equal(await access.accountValid({ instance: "sandbox", userId: 4 }), false);
  assert.deepEqual(readFileSync(filename), record);
});
