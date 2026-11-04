const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/lib/mystic/native-post-preflight.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(compiled, filename);
const { validateMysticPost, validateMysticReplyParent } = mod.exports;
const ctx = { userId: 5, areaId: 180, canPost: true, isPublicEcho: true };
const draft = { subject: "Hello", recipient: "All", body: "Line one\r\nLine two" };
test("authorized echo post normalizes body without writing files", () => {
  const result = validateMysticPost(ctx, draft);
  assert.equal(result.body, "Line one\nLine two");
  assert.equal(result.replyTo, null);
  assert.equal(result.userId, 5);
});
test("Post ACS denial and non-public area fail closed", () => {
  assert.throws(() => validateMysticPost({ ...ctx, canPost: false }, draft));
  assert.throws(() => validateMysticPost({ ...ctx, isPublicEcho: false }, draft));
});
test("malformed identity, area and reply number are rejected", () => {
  assert.throws(() => validateMysticPost({ ...ctx, userId: 0 }, draft));
  assert.throws(() => validateMysticPost({ ...ctx, areaId: -1 }, draft));
  assert.throws(() => validateMysticPost(ctx, { ...draft, replyTo: 0 }));
});
test("oversized, empty and control-bearing drafts are rejected", () => {
  assert.throws(() => validateMysticPost(ctx, { ...draft, subject: "" }));
  assert.throws(() => validateMysticPost(ctx, { ...draft, body: "x".repeat(65537) }));
  assert.throws(() => validateMysticPost(ctx, { ...draft, body: "hello\u0000" }));
});
test("reply requires authorized parent in the same area", () => {
  const post = validateMysticPost(ctx, { ...draft, replyTo: 100 });
  assert.doesNotThrow(() => validateMysticReplyParent(post, { areaId: 180, number: 100 }));
  assert.throws(() => validateMysticReplyParent(post, { areaId: 181, number: 100 }));
  assert.throws(() => validateMysticReplyParent(post, null));
});
