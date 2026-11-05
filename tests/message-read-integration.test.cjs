const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
function load(name, deps = {}) {
  const file = path.resolve(__dirname, "../src/lib/mystic/" + name + ".ts");
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod.require = id => id === "server-only" ? {} : deps[id] || require(id);
  mod._compile(js, file);
  return mod.exports;
}
const sidecar = load("message-sidecar");
const writer = load("message-receipt-writer", { "./message-sidecar": sidecar });
const { recordVerifiedMessageOpen } = load("message-read-integration", { "./message-receipt-writer": writer });
const stableId = "mw_12345678-1234-1234-1234-123456789abc";
test("verified message open persists receipt for the authenticated user only", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-integration-"));
  try {
    const context = { metadataRoot: root, instanceId: "mystic_sandbox", userId: 5, areaId: 23, jamNumber: 464 };
    const receipt = await recordVerifiedMessageOpen(context, {
      authorize: async () => true, resolveStableId: async () => stableId,
    });
    assert.ok(receipt.messages[stableId]);
    assert.equal((await sidecar.readUserMessageReceipt(root, "mystic_sandbox", 23, 5)).userId, 5);
    assert.equal(await sidecar.readUserMessageReceipt(root, "mystic_sandbox", 23, 6), null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("denied or unresolved opens never write receipts", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-integration-"));
  try {
    const context = { metadataRoot: root, instanceId: "mystic_sandbox", userId: 5, areaId: 23, jamNumber: 464 };
    let resolved = false;
    assert.equal(await recordVerifiedMessageOpen(context, {
      authorize: async () => false, resolveStableId: async () => { resolved = true; return stableId; },
    }), null);
    assert.equal(resolved, false);
    assert.equal(await recordVerifiedMessageOpen(context, {
      authorize: async () => true, resolveStableId: async () => null,
    }), null);
    assert.deepEqual(fs.readdirSync(root), []);
    await assert.rejects(recordVerifiedMessageOpen({ ...context, jamNumber: 0 }, {
      authorize: async () => true, resolveStableId: async () => stableId,
    }));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
