const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function loadTs(name, imports = {}) {
  const filename = path.resolve(__dirname, "../src/lib/mystic/" + name + ".ts");
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => id === "server-only" ? {} : imports[id] || require(id);
  mod._compile(js, filename);
  return mod.exports;
}
const sidecar = loadTs("message-sidecar");
const { recordUserMessageRead } = loadTs("message-receipt-writer", { "./message-sidecar": sidecar });
const ID = "mw_12345678-1234-1234-1234-123456789abc";
const ID2 = "mw_abcdefab-1234-1234-1234-123456789abc";

test("JSON read receipts persist per user and preserve first read timestamp", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-receipt-write-"));
  try {
    const first = await recordUserMessageRead(root, "sandbox", 23, 5, ID, new Date("2026-11-05T10:00:00Z"));
    assert.equal(first.messages[ID].readAt, "2026-11-05T10:00:00.000Z");
    await recordUserMessageRead(root, "sandbox", 23, 5, ID2, new Date("2026-11-05T10:01:00Z"));
    await recordUserMessageRead(root, "sandbox", 23, 5, ID, new Date("2026-11-05T10:02:00Z"));
    const stored = await sidecar.readUserMessageReceipt(root, "sandbox", 23, 5);
    assert.equal(stored.messages[ID].readAt, first.messages[ID].readAt);
    assert.ok(stored.messages[ID2]);
    assert.equal(await sidecar.readUserMessageReceipt(root, "sandbox", 23, 6), null);
    assert.equal(await sidecar.readUserMessageReceipt(root, "sandbox", 24, 5), null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("rejects invalid scope and does not write to native files", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-receipt-write-"));
  try {
    await assert.rejects(recordUserMessageRead(root, "../live", 23, 5, ID));
    await assert.rejects(recordUserMessageRead(root, "sandbox", 23, 5, "../escape"));
    assert.deepEqual(fs.readdirSync(root), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("refuses symlinked metadata roots", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-receipt-write-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "mw-receipt-outside-"));
  try {
    fs.mkdirSync(path.join(root, "v1"));
    try { fs.symlinkSync(outside, path.join(root, "v1", "instances"), "dir"); }
    catch (e) {
      if (e.code === "EPERM" || e.code === "EACCES") { t.skip("Windows symlink privilege unavailable"); return; }
      throw e;
    }
    await assert.rejects(recordUserMessageRead(root, "sandbox", 23, 5, ID));
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
