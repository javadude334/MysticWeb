const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
function load(name) {
  const filename = path.resolve(__dirname, "../src/lib/mystic", name);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === "server-only" ? {} : id === "./native-password" ?
    { MYSTIC_USER_RECORD_SIZE: 1536 } : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const { parseFtnRecipient, netmailRecipientStatus } = load("ftn-recipient.ts");
test("NetMail accepts a valid FTN destination without a nodelist hit", () => {
  assert.deepEqual(parseFtnRecipient("bamageek@68:1/0"), {
    name: "bamageek", address: "68:1/0", zone: 68, net: 1, node: 0, point: 0,
  });
  const status = netmailRecipientStatus("bamageek@68:1/0", null);
  assert.equal(status.valid, true);
  assert.match(status.warning, /still permitted/);
  assert.equal(netmailRecipientStatus("bamageek@68:1/0", { address: "68:1/0", label: "Hub" }).warning, null);
});
test("NetMail rejects malformed FTN destinations", () => {
  for (const input of ["someone", "name@0:1/2", "name@1:99999/2", "name@1:2/99999",
    "name@1:2/3.99999", "@1:2/3", "name@1:2/3@other", "name@1:2"]) {
    assert.equal(parseFtnRecipient(input), null, input);
  }
});
const { searchLocalRecipients, resolveLocalRecipient } = load("mail-recipients.ts");
const os = require("node:os");
test("native local recipient lookup matches handle/name and rejects missing IDs", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mystic-mail-users-"));
  try {
    const users = path.join(dir, "users.dat");
    const record = Buffer.alloc(1536);
    record.writeUInt32LE(42, 0);
    record[109] = 4; record.write("Dave", 110, "ascii");
    record[140] = 11; record.write("David Smith", 141, "ascii");
    fs.writeFileSync(users, record);
    assert.deepEqual(await searchLocalRecipients(users, "dav"), [
      { userId: 42, handle: "Dave", realName: "David Smith" },
    ]);
    assert.equal((await resolveLocalRecipient(users, 42)).handle, "Dave");
    assert.equal(await resolveLocalRecipient(users, 43), null);
    assert.deepEqual(await searchLocalRecipients(users, "unknown"), []);
    record.writeUInt32LE(1, 4);
    fs.writeFileSync(users, record);
    assert.equal(await resolveLocalRecipient(users, 42), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
