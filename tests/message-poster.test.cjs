const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/mystic/poster.ts");
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const original = loaded.require.bind(loaded);
loaded.require = id => id === "server-only" ? {} :
  id === "../auth/native" ? { NativeAccessError: class NativeAccessError extends Error {} } : original(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { MessagePoster, validateMessageDraft } = loaded.exports;

const identity = { instance: "vm", userId: 42 };
const draft = { areaId: 3, catalogRevision: "a".repeat(64), recipient: "All", subject: "Test", body: "Hello" };

test("posting is unavailable without an explicitly configured native writer", async () => {
  await assert.rejects(new MessagePoster(null, "vm").post(identity, draft));
});

test("posting validates inputs and rejects unsafe or ambiguous drafts", () => {
  assert.deepEqual(validateMessageDraft(draft), draft);
  assert.equal(validateMessageDraft({ ...draft, replyTo: 17 }).replyTo, 17);
  for (const invalid of [
    { ...draft, areaId: 0 }, { ...draft, replyTo: 0 },
    { ...draft, recipient: "All\nBCC: sysop" }, { ...draft, body: "" },
    { ...draft, subject: "Hi\u0000" }, { ...draft, extra: "unexpected" },
    { ...draft, catalogRevision: "invalid" },
  ]) assert.throws(() => validateMessageDraft(invalid));
});

test("native writer receives identity and reply reference, and must return matching receipt", async () => {
  const reply = { ...draft, replyTo: 17 };
  let called = false;
  const poster = new MessagePoster({ post: async (caller, input, signal) => {
    called = true;
    assert.deepEqual(caller, identity);
    assert.deepEqual(input, reply);
    assert.equal(signal.aborted, false);
    return { areaId: 3, messageNumber: 29, replyTo: 17 };
  } }, "vm");
  assert.deepEqual(await poster.post(identity, reply), { areaId: 3, messageNumber: 29, replyTo: 17 });
  assert.equal(called, true);
});

test("mismatched writer receipts and caller instances fail closed", async () => {
  const poster = new MessagePoster({ post: async () => ({ areaId: 9, messageNumber: 29, replyTo: null }) }, "vm");
  await assert.rejects(poster.post(identity, draft));
  await assert.rejects(poster.post({ instance: "other", userId: 42 }, draft));
});
