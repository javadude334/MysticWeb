const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/lib/mystic/disposable-post-model.ts");
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
const original = mod.require.bind(mod);
mod.require = id => id === "server-only" ? {} : original(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { DisposablePostModel } = mod.exports;
const revision = "a".repeat(64);
const identity = { instance: "mystic_sandbox", userId: 5 };
const draft = { areaId: 180, catalogRevision: revision, recipient: "All", subject: "Test", body: "Hello" };

test("disposable writer model serializes simultaneous posts and preserves reply references", async () => {
  const model = new DisposablePostModel(async () => true, revision, 180);
  const signal = new AbortController().signal;
  const receipts = await Promise.all(Array.from({ length: 20 }, () => model.post(identity, draft, signal)));
  assert.deepEqual(receipts.map(r => r.messageNumber), Array.from({ length: 20 }, (_, i) => i + 1));
  const reply = await model.post(identity, { ...draft, replyTo: 3 }, signal);
  assert.deepEqual(reply, { areaId: 180, messageNumber: 21, replyTo: 3 });
  assert.equal(model.snapshot()[20].replyTo, 3);
});

test("disposable writer model rejects unauthorized, stale, missing-parent and cancelled writes", async () => {
  let allowed = true;
  const model = new DisposablePostModel(async () => allowed, revision, 180);
  const signal = new AbortController().signal;
  allowed = false;
  await assert.rejects(model.post(identity, draft, signal));
  allowed = true;
  await assert.rejects(model.post(identity, { ...draft, catalogRevision: "b".repeat(64) }, signal));
  await assert.rejects(model.post(identity, { ...draft, replyTo: 999 }, signal));
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(model.post(identity, draft, cancelled.signal));
  assert.equal(model.snapshot().length, 0);
  assert.equal((await model.post(identity, draft, signal)).messageNumber, 1);
});

test("queued authorization is rechecked when execution begins", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const model = new DisposablePostModel(async () => {
    calls++;
    if (calls === 1) await gate;
    return calls === 1;
  }, revision, 180);
  const signal = new AbortController().signal;
  const first = model.post(identity, draft, signal);
  const second = model.post(identity, draft, signal);
  release();
  await first;
  await assert.rejects(second);
  assert.equal(model.snapshot().length, 1);
});
