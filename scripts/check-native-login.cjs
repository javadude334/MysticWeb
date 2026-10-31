#!/usr/bin/env node
// Local sandbox diagnostic only. Never pass passwords on command line or log them.
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const Module = require("node:module");
const ts = require("typescript");

function load(file) {
  const filename = path.resolve(__dirname, "../src/lib/mystic", file + ".ts");
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = m.require.bind(m);
  m.require = id => id === "server-only" ? {} :
    id === "./native-password" ? load("native-password") : original(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return m.exports;
}

async function secretPrompt() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Interactive terminal required; do not pipe credentials");
  }
  process.stdout.write("Sandbox account password (hidden): ");
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let secret = "";
    function finish(error) {
      process.stdin.removeListener("keypress", keypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error); else resolve(secret);
    }
    function keypress(ch, key) {
      if (key?.ctrl && key.name === "c") return finish(new Error("Cancelled"));
      if (key?.name === "return" || key?.name === "enter") return finish();
      if (key?.name === "backspace") { secret = secret.slice(0, -1); return; }
      if (ch && !key?.ctrl && !key?.meta && secret.length < 256) secret += ch;
    }
    process.stdin.on("keypress", keypress);
  });
}

(async () => {
  const [root, username] = process.argv.slice(2);
  if (!root || !path.isAbsolute(root) || !username || !/^[\x21-\x7e]{1,30}$/.test(username)) {
    process.stderr.write("Usage: node scripts/check-native-login.cjs <absolute-sandbox-root> <handle>\n");
    process.exitCode = 2;
    return;
  }
  const filename = path.join(root, "data", "users.dat");
  const st = fs.lstatSync(filename);
  if (!st.isFile() || st.isSymbolicLink()) throw new Error("Sandbox users.dat unavailable");
  const password = await secretPrompt();
  const { verifyMysticHandle } = load("native-user-login");
  const result = await verifyMysticHandle(filename, username, password);
  process.stdout.write(result ?
    `PASS: native method-2 credentials verified for user ID ${result.userId}. Web login remains disabled.\n` :
    "DENIED: native credentials not verified (or account is restricted).\n");
  if (!result) process.exitCode = 1;
})().catch(() => {
  process.stderr.write("Unable to complete sandbox verification. Check path and terminal.\n");
  process.exitCode = 2;
});
