const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/lib/mystic/message-sidecar.ts");
const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod.require = id => id === "server-only" ? {} : require(id);
mod._compile(js, filename);
const { newMessageSidecar, readUserMessageReceipt } = mod.exports;
const msg = { number: 142, messageId: "abc@example", dates: { written: 1793802720, timezone: null } };
test("creates a distinct stable-format ID and preserves raw JAM date", () => {
  const a = newMessageSidecar("mystic_sandbox", 23, "general", msg);
  const b = newMessageSidecar("mystic_sandbox", 23, "general", msg);
  assert.match(a.id, /^mw_[0-9a-f-]{36}$/);
  assert.notEqual(a.id, b.id);
  assert.equal(a.dates.writtenRaw, msg.dates.written);
  assert.equal(a.dates.timezone, null);
  assert.equal(a.origin.jamNumber, 142);
});
test("rejects untrusted area, instance and JAM basename", () => {
  assert.throws(() => newMessageSidecar("../live", 23, "general", msg));
  assert.throws(() => newMessageSidecar("sandbox", 0, "general", msg));
  assert.throws(() => newMessageSidecar("sandbox", 23, "../secret", msg));
});
test("missing receipt is unknown; existing receipt is scoped to user", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-sidecar-"));
  try {
    assert.equal(await readUserMessageReceipt(root, "sandbox", 23, 5), null);
    const dir = path.join(root, "v1", "instances", "sandbox", "areas", "23", "users");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "5.json"), JSON.stringify({
      schemaVersion: 1, instanceId: "sandbox", userId: 5, areaId: 23,
      messages: {}, updatedAt: new Date().toISOString()
    }));
    assert.equal((await readUserMessageReceipt(root, "sandbox", 23, 5)).userId, 5);
    assert.equal(await readUserMessageReceipt(root, "sandbox", 23, 6), null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("rejects mismatched user data and malformed receipts", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-sidecar-"));
  try {
    const dir = path.join(root, "v1", "instances", "sandbox", "areas", "23", "users");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "5.json"), JSON.stringify({
      schemaVersion: 1, instanceId: "sandbox", userId: 6, areaId: 23,
      messages: {}, updatedAt: new Date().toISOString()
    }));
    await assert.rejects(readUserMessageReceipt(root, "sandbox", 23, 5));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
