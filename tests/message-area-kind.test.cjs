const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/mystic/reader.ts");
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
const original = m.require.bind(m);
m.require = id => id === "server-only" ? {} :
  id === "../auth/native" ? { NativeAccessError: class NativeAccessError extends Error {} } :
  id === "./jam" ? { isJamBaseName: x => /^[a-z_]+$/.test(x), readJam: async () => ({ messages: [], nextBefore: null }) } :
  original(id);
m._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { MessageReader } = m.exports;
const revision = "a".repeat(64);
const areas = [
  { id: 1, name: "General", jamBase: "general", kind: "echo", groupIds: [1] },
  { id: 2, name: "Netmail", jamBase: "netmail", kind: "netmail" },
  { id: 3, name: "Personal", jamBase: "personal", kind: "private" },
  { id: 4, name: "Unknown", jamBase: "unknown", kind: "unknown" },
];
test("netmail, private and unverified areas never reach native authorization or JAM storage", async () => {
  const authorized = [], read = [];
  const native = { readArea: async (_identity, id, _revision, callback) => {
    authorized.push(id);
    return callback();
  }};
  const reader = new MessageReader(native, async () => ({ revision, groups: [{ id: 1, name: "General" }], areas }), "/unused",
    async (_root, base) => { read.push(base); return { messages: [], nextBefore: null }; });
  const identity = { instance: "sandbox", userId: 2 };
  assert.deepEqual(await reader.areas(identity), { groups: [{ id: 1, name: "General" }], areas: [{ id: 1, name: "General", groupIds: [1] }] });
  assert.deepEqual(authorized, [1]);
  for (const id of [2, 3, 4]) await assert.rejects(reader.read(identity, id, {}));
  assert.deepEqual(read, []);
  await reader.read(identity, 1, {});
  assert.deepEqual(read, ["general"]);
});
test("missing kind fails closed for the entire catalog", async () => {
  const reader = new MessageReader({ readArea: async () => { throw Error("should not run"); } },
    async () => ({ revision, areas: [{ id: 5, name: "Unclassified", jamBase: "unknown" }] }), "/unused");
  await assert.rejects(reader.areas({ instance: "sandbox", userId: 2 }));
});
