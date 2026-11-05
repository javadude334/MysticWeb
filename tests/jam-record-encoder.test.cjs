const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const file = path.resolve(__dirname, "../src/lib/mystic/jam-record-encoder.ts");
const mod = new Module(file, module);
mod.filename = file;
mod.paths = Module._nodeModulePaths(path.dirname(file));
const requireOriginal = mod.require.bind(mod);
mod.require = name => name === "server-only" ? {} : requireOriginal(name);
mod._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { encodeJamDraft } = mod.exports;

function draft() {
  return { number: 42, author: "Javadude", recipient: "All", subject: "Hello",
    body: "First line\nSecond line", timestamp: 1700000000, messageId: "<42@test>",
    replyTo: 41, replyId: "<41@test>" };
}

test("encodes JAM revision 1 header, index, UTF-8 subfields and reply reference", () => {
  const { header, text, index } = encodeJamDraft(draft(), 1024, 200);
  assert.equal(header.subarray(0, 4).toString("hex"), "4a414d00");
  assert.equal(header.readUInt16LE(4), 1);
  assert.equal(header.readUInt32LE(24), 41);
  assert.equal(header.readUInt32LE(48), 42);
  assert.equal(header.readUInt32LE(60), 200);
  assert.equal(header.readUInt32LE(64), text.length);
  assert.equal(header.readUInt32LE(68), 0xffffffff);
  assert.equal(index.readUInt32LE(4), 1024);
  assert.equal(text.toString("utf8"), "First line\rSecond line");
  assert.ok(header.includes(Buffer.from("CHRS: UTF-8 4")));
  assert.ok(header.includes(Buffer.from("<41@test>")));
});

test("rejects unsafe, empty and overflowing drafts before touching files", () => {
  assert.throws(() => encodeJamDraft({ ...draft(), number: 0 }, 1024, 0));
  assert.throws(() => encodeJamDraft({ ...draft(), body: "" }, 1024, 0));
  assert.throws(() => encodeJamDraft({ ...draft(), subject: "bad\u0000name" }, 1024, 0));
  assert.throws(() => encodeJamDraft(draft(), 1024, 0xffffffff));
  assert.throws(() => encodeJamDraft(draft(), 12, 0));
});
