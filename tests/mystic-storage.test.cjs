const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function loadTs(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === "server-only" ? {} : original(id);
  mod._compile(js, filename);
  return mod.exports;
}

test("Mystic A47 directories resolve from configured fields, not hardcoded data/msgs", () => {
  const { parseMysticDirectories } = loadTs("src/lib/mystic/directories.ts");
  const bytes = Buffer.alloc(8192);
  bytes[0] = 8;
  bytes.write("1.12 A47", 1, "ascii");
  function set(offset, value) {
    const raw = Buffer.from(value, "latin1");
    bytes[offset] = raw.length;
    raw.copy(bytes, offset + 1);
  }
  set(17, "C:\\MysticSandbox\\");
  set(98, "D:\\MysticData\\");
  set(260, "E:\\MessageBases\\");
  const config = parseMysticDirectories(bytes, "C:\\MysticSandbox");
  assert.equal(config.dataDir.toLowerCase(), "d:\\mysticdata");
  assert.equal(config.messageDir.toLowerCase(), "e:\\messagebases");
  assert.equal(config.databasePath.toLowerCase(), "d:\\mysticdata\\mysticweb.db");
  bytes.write("1.12 A99", 1, "ascii");
  assert.throws(() => parseMysticDirectories(bytes, "C:\\MysticSandbox"), /Unsupported/);
});

test("SQLite schema upgrades once, survives reopen, and rejects future versions", () => {
  const { DatabaseSync } = require("node:sqlite");
  const { initializeMysticWebSchema } = loadTs("src/lib/storage/schema.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mysticweb-schema-"));
  const filename = path.join(dir, "state.db");
  try {
    let db = new DatabaseSync(filename);
    initializeMysticWebSchema(db);
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 1);
    db.prepare("INSERT INTO mysticweb_settings(key,value) VALUES (?,?)").run("example", "persisted");
    initializeMysticWebSchema(db);
    db.close();
    db = new DatabaseSync(filename);
    initializeMysticWebSchema(db);
    assert.equal(db.prepare("SELECT value FROM mysticweb_settings WHERE key = ?").get("example").value, "persisted");
    db.exec("PRAGMA user_version = 999");
    assert.throws(() => initializeMysticWebSchema(db), /incompatible/);
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
