#!/usr/bin/env node
// Operator-only diagnostics. Never prints names, paths, headers or message text.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { loadEnvConfig } = require('@next/env');

// Match the other standalone Mystic validator: load local development settings.
// Explicitly exported environment variables retain precedence.
loadEnvConfig(path.resolve(__dirname, '..'), true);
const sourceFile = path.resolve(__dirname, '../src/lib/mystic/jam.ts');
const loaded = new Module(sourceFile, module);
loaded.filename = sourceFile;
loaded.paths = Module._nodeModulePaths(path.dirname(sourceFile));
const original = loaded.require.bind(loaded);
loaded.require = id => id === 'server-only' ? {} : original(id);
loaded._compile(ts.transpileModule(fs.readFileSync(sourceFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, sourceFile);

let stage = 'initialization';
async function main() {
  stage = 'Mystic root configuration';
  // Mystic 1.12 A48 stores Message Base Path as a length-prefixed field
  // at offset 260 of data/mystic.dat. Do not duplicate this setting in env.
  const mysticRoot = process.env.MYSTIC_DATA_ROOT;
  if (!mysticRoot || !path.isAbsolute(mysticRoot)) throw new Error('configuration');
  stage = 'reading native configuration';
  const nativeConfig = await fs.promises.readFile(path.join(mysticRoot, 'data', 'mystic.dat'));
  if (nativeConfig.length !== 8192) throw new Error('configuration');
  const length = nativeConfig[260];
  if (!length || length > 80 || 261 + length > nativeConfig.length) throw new Error('configuration');
  const root = nativeConfig.subarray(261, 261 + length).toString('latin1');
  if (!path.isAbsolute(root) || root.includes('\\0')) throw new Error('configuration');
  stage = 'reading message-base directory';
  const files = await fs.promises.readdir(root);
  stage = 'validating JAM bases';
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
main().catch(error => {
  const code = typeof error?.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'INVALID_CONFIGURATION';
  console.error(`JAM validation unavailable at stage: ${stage} (${code}).`);
  process.exitCode = 1;
});
