const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
function load(name, deps = {}) {
 const file = path.resolve(__dirname, "../src/lib/mystic/" + name + ".ts");
 const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
 const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
 m.require = id => id === "server-only" ? {} : deps[id] || require(id); m._compile(js, file); return m.exports;
}
const sidecar = load("message-sidecar");
const { recordUserMessageRead } = load("message-receipt-writer", { "./message-sidecar": sidecar });
const a = "mw_12345678-1234-1234-1234-123456789abc";
const b = "mw_abcdefab-1234-1234-1234-123456789abc";
test("JSON last-read pointer advances only through verified contiguous receipts", async () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-json-pointer-"));
 try {
  await recordUserMessageRead(root, "sandbox", 23, 5, a);
  await recordUserMessageRead(root, "sandbox", 23, 5, b);
  const result = await recordUserMessageRead(root, "sandbox", 23, 5, a, new Date(), {
   baseline: 463, contiguousRead: [{ number: 464, id: a }, { number: 465, id: b }]
  });
  assert.equal(result.lastReadJamNumber, 465);
  const again = await recordUserMessageRead(root, "sandbox", 23, 5, a);
  assert.equal(again.lastReadJamNumber, 465);
  assert.equal((await sidecar.readUserMessageReceipt(root, "sandbox", 23, 5)).lastReadJamNumber, 465);
  assert.equal(await sidecar.readUserMessageReceipt(root, "sandbox", 23, 6), null);
 } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("JSON pointer rejects gaps, missing receipts, stale baselines and rewinds", async () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-json-pointer-"));
 try {
  await recordUserMessageRead(root, "sandbox", 23, 5, a);
  const run = evidence => recordUserMessageRead(root, "sandbox", 23, 5, a, new Date(), evidence);
  await assert.rejects(run({ baseline: 463, contiguousRead: [{ number: 465, id: a }] }));
  await assert.rejects(run({ baseline: 463, contiguousRead: [{ number: 464, id: b }] }));
  assert.equal((await sidecar.readUserMessageReceipt(root, "sandbox", 23, 5)).lastReadJamNumber, undefined);
  await run({ baseline: 463, contiguousRead: [{ number: 464, id: a }] });
  await assert.rejects(run({ baseline: 463, contiguousRead: [] }));
  await assert.rejects(run({ baseline: 464, contiguousRead: [{ number: 464, id: a }] }));
  assert.equal((await sidecar.readUserMessageReceipt(root, "sandbox", 23, 5)).lastReadJamNumber, 464);
 } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
