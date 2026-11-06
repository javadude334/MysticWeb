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
const { readJam } = (() => {
  const filename = path.resolve(__dirname, "../src/lib/mystic/jam.ts");
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name === "server-only" ? {} : original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
})();
const draft = { author: "Tester", recipient: "All", subject: "Offline test", body: "Hello world", timestamp: 1700000000 };

test("JAM writer refuses production execution", async () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    await assert.rejects(appendOfflineJam(os.tmpdir(), "test", draft), /disabled/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("offline JAM writer appends index, header and text to disposable base", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mysticweb-jam-offline-"));
  try {
    const header = Buffer.alloc(1024);
    header.write("JAM\0", 0, "binary");
    header.writeUInt32LE(0xffffffff, 16);
    header.writeUInt32LE(1, 20);
    fs.writeFileSync(path.join(dir, "demo.jhr"), header);
    fs.writeFileSync(path.join(dir, "demo.jdx"), Buffer.alloc(0));
    fs.writeFileSync(path.join(dir, "demo.jdt"), Buffer.alloc(0));
    const result = await appendOfflineJam(dir, "demo", draft);
    assert.equal(result.number, 1);
    assert.equal(fs.readFileSync(path.join(dir, "demo.jdx")).readUInt32LE(4), 1024);
    assert.equal(fs.readFileSync(path.join(dir, "demo.jhr")).readUInt32LE(1072), 1);
    assert.match(fs.readFileSync(path.join(dir, "demo.jdt")).toString(), /^Hello world\r\r---\rPosted with MysticWeb v0\.1\.0$/);
    assert.equal(fs.existsSync(path.join(dir, "demo.mysticweb-offline.lock")), false);
    const firstReply = await appendOfflineJam(dir, "demo", { ...draft, subject: "Reply one", replyTo: 1 });
    const secondReply = await appendOfflineJam(dir, "demo", { ...draft, subject: "Reply two", replyTo: 1 });
    assert.equal(firstReply.number, 2);
    assert.equal(secondReply.number, 3);
    const index = fs.readFileSync(path.join(dir, "demo.jdx"));
    const records = fs.readFileSync(path.join(dir, "demo.jhr"));
    const parentOffset = index.readUInt32LE(4);
    const replyOneOffset = index.readUInt32LE(12);
    const replyTwoOffset = index.readUInt32LE(20);
    assert.equal(records.readUInt32LE(parentOffset + 28), 2);
    assert.equal(records.readUInt32LE(replyOneOffset + 24), 1);
    assert.equal(records.readUInt32LE(replyOneOffset + 32), 3);
    assert.equal(records.readUInt32LE(replyTwoOffset + 24), 1);
    assert.equal(records.readUInt32LE(replyTwoOffset + 32), 0);
    assert.equal(fs.statSync(path.join(dir, "demo.jdx")).size, 24);
    // Exercise the actual MysticWeb JAM reader, not a writer-specific decoder.
    const page = await readJam(dir, "demo", { limit: 10 });
    assert.deepEqual(page.messages.map(m => m.number), [3, 2, 1]);
    const opened = await readJam(dir, "demo", { message: 3 });
    assert.equal(opened.messages[0].replyTo, 1);
    assert.match(opened.messages[0].body, /Hello world[\s\S]*Posted with MysticWeb v0\.1\.0/);
    // Full post/reply/read round trip through the production JAM reader.
    const parent = await readJam(dir, "demo", { message: 1 });
    const replyOne = await readJam(dir, "demo", { message: 2 });
    assert.equal(parent.messages.length, 1);
    assert.equal(replyOne.messages.length, 1);
    assert.equal(parent.messages[0].subject, "Offline test");
    assert.equal(parent.messages[0].author, "Tester");
    assert.equal(parent.messages[0].recipient, "All");
    assert.equal(parent.messages[0].firstReply, 2);
    assert.equal(replyOne.messages[0].replyTo, 1);
    assert.equal(replyOne.messages[0].nextReply, 3);
    assert.equal(opened.messages[0].subject, "Reply two");
    assert.equal(opened.messages[0].nextReply ?? 0, 0);
    for (const message of [parent.messages[0], replyOne.messages[0], opened.messages[0]]) {
      assert.match(message.body, /Hello world[\s\S]*Posted with MysticWeb v0\.1\.0/);
      assert.equal((message.body.match(/Posted with MysticWeb v0\.1\.0/g) ?? []).length, 1);
    }
    // Failed writes must not change any JAM data or leave an offline lock.
    const beforeDenied = ["jhr", "jdx", "jdt"].map(ext => fs.readFileSync(path.join(dir, "demo." + ext)));
    await assert.rejects(
      appendOfflineJam(dir, "demo", { ...draft, replyTo: 99999 }),
      /Invalid reply parent/,
    );
    ["jhr", "jdx", "jdt"].forEach((ext, i) =>
      assert.deepEqual(fs.readFileSync(path.join(dir, "demo." + ext)), beforeDenied[i]));
    assert.equal(fs.existsSync(path.join(dir, "demo.mysticweb-offline.lock")), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("offline JAM writer waits briefly for another MysticWeb writer and preserves lock ownership", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mysticweb-jam-lock-"));
  try {
    const header = Buffer.alloc(1024);
    header.write("JAM\\0", 0, "binary");
    header.writeUInt32LE(0xffffffff, 16);
    header.writeUInt32LE(1, 20);
    fs.writeFileSync(path.join(dir, "demo.jhr"), header);
    fs.writeFileSync(path.join(dir, "demo.jdx"), Buffer.alloc(0));
    fs.writeFileSync(path.join(dir, "demo.jdt"), Buffer.alloc(0));
    const lockPath = path.join(dir, "demo.mysticweb-offline.lock");
    fs.writeFileSync(lockPath, "other writer", { flag: "wx" });
    const pending = appendOfflineJam(dir, "demo", draft);
    await new Promise(resolve => setTimeout(resolve, 150));
    fs.unlinkSync(lockPath);
    const result = await pending;
    assert.equal(result.number, 1);
    assert.equal(fs.statSync(path.join(dir, "demo.jdx")).size, 8);
    assert.equal(fs.existsSync(lockPath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
