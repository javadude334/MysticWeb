#!/usr/bin/env node
"use strict";
// Offline compatibility rehearsal. NEVER writes to the supplied Mystic files.
// Usage: node scripts/rehearse-jlr-pointer.cjs <absolute-jlr-file> <user-id> <message-number>
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function loadTs(file, parent) {
  const mod = new Module(file, parent || module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod.require = id => id === "server-only" ? {} :
    id === "./jam-last-read" ? loadTs(path.join(path.dirname(file), "jam-last-read.ts"), mod) :
    require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  return mod.exports;
}
async function main() {
  const [source, userText, messageText] = process.argv.slice(2);
  if (!source || !path.isAbsolute(source) || !/\.jlr$/i.test(source) ||
      !/^[1-9]\d*$/.test(userText || "") || !/^[1-9]\d*$/.test(messageText || ""))
    throw new Error("Usage: node scripts/rehearse-jlr-pointer.cjs <absolute-jlr-file> <user-id> <message-number>");
  const userId = Number(userText), messageNumber = Number(messageText);
  if (!Number.isSafeInteger(userId) || userId > 0xffffffff ||
      !Number.isSafeInteger(messageNumber) || messageNumber > 0xffffffff)
    throw new Error("Invalid numeric argument");
  const info = fs.lstatSync(source);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 1048576)
    throw new Error("Unsafe source file");
  const original = fs.readFileSync(source);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mystic-jlr-rehearsal-"));
  const jam = path.join(dir, "msgs");
  fs.mkdirSync(jam);
  const copy = path.join(jam, "rehearsal.jlr");
  fs.writeFileSync(copy, original, { flag: "wx" });
  const priorNodeEnv = process.env.NODE_ENV;
  const priorGate = process.env.MYSTICWEB_OFFLINE_JLR_TEST;
  try {
    const { parseJamLastRead, findJamLastRead } = loadTs(path.resolve(__dirname, "../src/lib/mystic/jam-last-read.ts"));
    const { advanceOfflineSandboxJamPointer } = loadTs(path.resolve(__dirname, "../src/lib/mystic/offline-jam-read-writer.ts"));
    const before = findJamLastRead(parseJamLastRead(original), userId);
    process.env.NODE_ENV = "development";
    process.env.MYSTICWEB_OFFLINE_JLR_TEST = "I_HAVE_STOPPED_MYSTIC";
    const outcome = await advanceOfflineSandboxJamPointer(dir, jam, "rehearsal", userId, messageNumber, true);
    const result = fs.readFileSync(copy);
    const after = findJamLastRead(parseJamLastRead(result), userId);
    const changed = [];
    for (let i = 0; i < original.length; i++)
      if (original[i] !== result[i]) changed.push(i);
    const offset = before ? parseJamLastRead(original).findIndex(r => r.userId === userId) * 16 : -1;
    if (result.length !== original.length ||
        changed.some(i => i < offset + 8 || i >= offset + 16))
      throw new Error("Rehearsal changed bytes outside the selected user's pointer fields");
    console.log(JSON.stringify({ sourceUnchanged: fs.readFileSync(source).equals(original),
      outcome, userId, messageNumber, before: before || null, after: after || null,
      changedByteOffsets: changed, copyWasTemporary: true }, null, 2));
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
    if (priorGate === undefined) delete process.env.MYSTICWEB_OFFLINE_JLR_TEST; else process.env.MYSTICWEB_OFFLINE_JLR_TEST = priorGate;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(err => { console.error("JLR rehearsal failed:", err.message); process.exitCode = 1; });
