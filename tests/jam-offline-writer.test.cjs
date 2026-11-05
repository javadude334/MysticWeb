const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function load(filename) {
  const absolute = path.resolve(__dirname, "../src/lib/mystic", filename);
  const mod = new Module(absolute, module);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name.startsWith("./") && name !== "./jam") return load(name + ".ts");
    if (name === "./jam") return { isJamBaseName: value => /^[a-zA-Z0-9_][a-zA-Z0-9_&!'.-]{0,39}$/.test(value) && !value.includes("..") };
    return original(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, absolute);
  return mod.exports;
}
const { appendOfflineJam } = load("jam-offline-writer.ts");
const draft = { author: "Tester", recipient: "All", subject: "Offline test", body: "Hello world", timestamp: 1700000000 };

test("offline JAM writer is disabled without explicit operator confirmation", async () => {
  await assert.rejects(appendOfflineJam(os.tmpdir(), "test", draft, { offlineConfirmed: false }), /disabled/);
});

test("offline JAM writer appends index, header and text to disposable base", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mysticweb-jam-offline-"));
  const old = process.env.MYSTICWEB_OFFLINE_JAM_WRITE;
  try {
    const header = Buffer.alloc(1024);
    header.write("JAM\0", 0, "binary");
    header.writeUInt32LE(0xffffffff, 16);
    header.writeUInt32LE(1, 20);
    fs.writeFileSync(path.join(dir, "demo.jhr"), header);
    fs.writeFileSync(path.join(dir, "demo.jdx"), Buffer.alloc(0));
    fs.writeFileSync(path.join(dir, "demo.jdt"), Buffer.alloc(0));
    process.env.MYSTICWEB_OFFLINE_JAM_WRITE = "I_UNDERSTAND_OFFLINE_ONLY";
    const result = await appendOfflineJam(dir, "demo", draft, { offlineConfirmed: true });
    assert.equal(result.number, 1);
    assert.equal(fs.readFileSync(path.join(dir, "demo.jdx")).readUInt32LE(4), 1024);
    assert.equal(fs.readFileSync(path.join(dir, "demo.jhr")).readUInt32LE(48, 1024), 1);
    assert.equal(fs.readFileSync(path.join(dir, "demo.jdt")).toString(), "Hello world");
    assert.equal(fs.existsSync(path.join(dir, "demo.mysticweb-offline.lock")), false);
    await assert.rejects(appendOfflineJam(dir, "demo", { ...draft, replyTo: 1 }, { offlineConfirmed: true }), /Reply chain/);
    assert.equal(fs.statSync(path.join(dir, "demo.jdx")).size, 8);
  } finally {
    if (old === undefined) delete process.env.MYSTICWEB_OFFLINE_JAM_WRITE;
    else process.env.MYSTICWEB_OFFLINE_JAM_WRITE = old;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
