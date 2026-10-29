// Run interactively from the E: sandbox checkout. Never pass credentials as args.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createInterface } = require('node:readline/promises');
const { randomBytes } = require('node:crypto');
const ts = require('typescript');

function hiddenPassword() {
  const input = process.stdin;
  if (!input.isTTY || !process.stdout.isTTY) throw new Error('Interactive terminal required');
  process.stdout.write('Disposable sandbox password (hidden): ');
  return new Promise((resolve, reject) => {
    const bytes = [];
    function finish(error) {
      input.removeListener('data', receive); input.setRawMode(false); input.pause();
      process.stdout.write('\n');
      const value = error ? '' : Buffer.from(bytes).toString('ascii'); bytes.fill(0);
      if (error) reject(new Error('Input cancelled or unsupported')); else resolve(value);
    }
    function receive(chunk) {
      for (const b of chunk) {
        if (b === 13 || b === 10) { finish(false); return; }
        if (b === 3 || b === 4) { finish(true); return; }
        if (b === 8 || b === 127) { bytes.pop(); continue; }
        if (b < 32 || b > 126 || bytes.length >= 25) { finish(true); return; }
        bytes.push(b);
      }
    }
    input.setRawMode(true); input.on('data', receive); input.resume();
  });
}

function areaSetupHint() {
  // Metadata only, from the fixed sandbox path. Never treat it as authorization.
  const filename = "E:/mystic/data/mbases.dat";
  for (const part of ["E:/mystic", "E:/mystic/data", filename]) if (fs.lstatSync(part).isSymbolicLink()) return;
  const fd = fs.openSync(filename, "r");
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size % 768 || before.size > 512 * 768) return;
    const data = Buffer.alloc(before.size);
    if (fs.readSync(fd, data, 0, data.length, 0) !== data.length) return;
    const after = fs.fstatSync(fd);
    if (before.mtimeMs !== after.mtimeMs || before.size !== after.size) return;
    let named = 0; const publicIds = [];
    for (let offset = 0; offset < data.length; offset += 768) {
      const record = data.subarray(offset, offset + 768);
      if (record[77] > 60) return;
      if (record[77] > 0) named++;
      if ((record.readUInt32LE(577) & 16) === 0 && record[260] !== 3) publicIds.push(record.readUInt16LE(0));
    }
    if (!named) {
      console.log("NNTP_AREA_SETUP: all sandbox newsgroup names are blank");
      console.log("PUBLIC_AREA_IDS_FOR_EDITOR: " + publicIds.join(","));
      console.log("Set a newsgroup name through the E: native editor; preserve access rules and private/netmail settings.");
    }
  } finally { fs.closeSync(fd); }
}

async function main() {
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive use only');
  const root = path.resolve(__dirname, '..');
  if (process.platform !== 'win32' || root.toLowerCase() !== 'e:\\work\\javadude_dev\\mysticweb') throw new Error('Sandbox checkout required');
  const certfile = path.join(root, '.certificates', 'mystic-sandbox-cert.pem');
  const ca = fs.readFileSync(certfile);
  const filename = path.join(root, 'src', 'lib', 'auth', 'nntps.ts');
  const mod = new Module(filename, module); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name === 'server-only' ? {} : original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  const { NntpsSession } = mod.exports;
  console.log('E: sandbox native NNTPS login check. This does not enable web sessions.');
  console.log('Endpoint: 127.0.0.1:8563; certificate identity: mybbs.com; strict TLS validation.');
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const username = await readline.question('Disposable sandbox account: '); readline.close();
  let password = await hiddenPassword();
  const endpoint = { host: '127.0.0.1', port: 8563, servername: 'mybbs.com', ca };
  let session;
  try {
    session = await NntpsSession.login(endpoint, username, password);
    console.log('NATIVE_NNTPS_PASSWORD_ACCEPTED: PASS');
    // No group names, subjects, native records or passwords are emitted.
    try { const groups = await session.groups(); console.log('NATIVE_GROUP_LIST: PASS; count=' + groups.length); if (!groups.length) { try { areaSetupHint(); } catch { /* Hint failures never change authentication results. */ } } }
    catch (error) { console.log('NATIVE_GROUP_LIST: UNAVAILABLE; stage=' + (error.stage ?? 'UNKNOWN') + '; status=' + (error.statusCode ?? 'NONE')); }
    if (session) { await session.quit(); session = undefined; }
    let wrong = randomBytes(12).toString('hex');
    if (wrong === password) wrong = wrong === 'x' ? 'y' : 'x';
    password = '';
    try {
      const unexpected = await NntpsSession.login(endpoint, username, wrong);
      unexpected.close(); console.log('NATIVE_NNTPS_WRONG_PASSWORD_REJECTED: FAIL'); process.exitCode = 1;
     } catch (error) {
      if (error?.reason === 'CREDENTIALS_REJECTED') console.log('NATIVE_NNTPS_WRONG_PASSWORD_REJECTED: PASS; native=' + error.statusCode);
      else { console.log('NATIVE_NNTPS_WRONG_PASSWORD_REJECTED: INCONCLUSIVE (transport or protocol failure)'); process.exitCode = 1; }
    }
    finally { wrong = ''; }
    console.log('Permanent identity, eligibility, area permissions and browser end-to-end checks remain separate.');
  } finally { password = ''; session?.close(); }
}

main().catch(error => { console.error('NATIVE_NNTPS_LOGIN: DENIED_OR_UNAVAILABLE; stage=' + (error.stage ?? 'INPUT') + '; status=' + (error.statusCode ?? 'NONE')); process.exitCode = 1; });
