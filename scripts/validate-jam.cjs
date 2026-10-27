#!/usr/bin/env node
// Operator-only diagnostics. Never prints names, paths, headers or message text.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sourceFile = path.resolve(__dirname, '../src/lib/mystic/jam.ts');
const loaded = new Module(sourceFile, module);
loaded.filename = sourceFile;
loaded.paths = Module._nodeModulePaths(path.dirname(sourceFile));
const original = loaded.require.bind(loaded);
loaded.require = id => id === 'server-only' ? {} : original(id);
loaded._compile(ts.transpileModule(fs.readFileSync(sourceFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, sourceFile);

async function main() {
  const root = process.env.MYSTIC_JAM_ROOT;
  if (!root) throw new Error('configuration');
  const files = await fs.promises.readdir(root);
  const totals = { bases: 0, messagesSampled: 0, scanned: 0, skipped: 0, changed: 0, unavailable: 0 };
  for (const filename of files) {
    if (!filename.endsWith('.jhr') || !loaded.exports.isJamBaseName(filename.slice(0, -4))) continue;
    totals.bases++;
    try {
      const result = await loaded.exports.readJam(root, filename.slice(0, -4), { limit: 1 });
      totals.messagesSampled += result.messages.length;
      totals.scanned += result.scanned;
      totals.skipped += result.skipped;
    } catch (error) {
      if (error.code === 'CHANGED') totals.changed++;
      else totals.unavailable++;
    }
  }
  console.log('Read-only JAM metadata validation (no message content displayed)');
  console.log(JSON.stringify(totals));
  if (!totals.bases || totals.unavailable) process.exitCode = 1;
}
main().catch(() => { console.error('JAM validation unavailable; check operator configuration and mount access.'); process.exitCode = 1; });
