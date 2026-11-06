const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/mystic/mailbox.ts");
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
const original = mod.require.bind(mod);
mod.require = name => name === "server-only" ? {} : original(name);
mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { localMailFolder, netmailVisibleWithoutNativeRoutingProof } = mod.exports;
const scope = { kind: "local", areaId: 1, jamBase: "email", verified: true };
const identity = { userId: 12, handle: "Dave" };
const message = { number: 3, author: "Alice", recipient: "Dave", attributes: 0 };

test("local mail identifies inbox and sent by exact verified handle", () => {
  assert.equal(localMailFolder(scope, identity, message), "inbox");
  assert.equal(localMailFolder(scope, identity, { ...message, author: "dAvE", recipient: "Bob" }), "sent");
  assert.equal(localMailFolder(scope, identity, { ...message, author: "Dave2", recipient: "NotDave" }), null);
});
test("mailbox refuses unverified scopes, invalid identities and hidden records", () => {
  assert.equal(localMailFolder({ ...scope, verified: false }, identity, message), null);
  assert.equal(localMailFolder({ ...scope, kind: "netmail" }, identity, message), null);
  assert.equal(localMailFolder(scope, { ...identity, handle: "" }, message), null);
  assert.equal(localMailFolder(scope, identity, { ...message, attributes: 4 }), null);
  assert.equal(localMailFolder(scope, identity, { ...message, attributes: 0x80000000 }), null);
});
test("NetMail remains denied until native routing and ownership are verified", () => {
  assert.equal(netmailVisibleWithoutNativeRoutingProof(), false);
});
