const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/auth/nntps.ts');
const mod = new Module(filename, module);
mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
const original = mod.require.bind(mod);
mod.require = id => id === 'server-only' ? {} : original(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { NntpsSession } = mod.exports;
let directory, key, cert;
before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mystic-nntps-test-'));
  const bundled = ['C:/DevApps/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/usr/bin/openssl.exe'].find(p => fs.existsSync(p));
  const openssl = process.env.MYSTIC_TEST_OPENSSL || (bundled || 'openssl');
  const result = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost',
    '-keyout', path.join(directory, 'key.pem'), '-out', path.join(directory, 'cert.pem')], { stdio: 'ignore' });
  assert.equal(result.status, 0, 'Disposable TLS certificate generation must succeed');
  key = fs.readFileSync(path.join(directory, 'key.pem')); cert = fs.readFileSync(path.join(directory, 'cert.pem'));
});
after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });

async function fixture(t, mode = '') {
  const sockets = new Set(); const commands = [];
  const server = tls.createServer({ key, cert, minVersion: 'TLSv1.2' }, socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    let input = ''; let selectedUser = ''; let authenticated = false; let group = '';
    const send = value => socket.write(value + '\r\n');
    send('200 Disposable test server');
    socket.on('data', data => {
      input += data.toString('ascii');
      let end;
      while ((end = input.indexOf('\r\n')) !== -1) {
        const line = input.slice(0, end); input = input.slice(end + 2);
        const [command, sub, ...rest] = line.split(' ');
        // Record command names only, never candidates or complete commands.
        commands.push(command === 'AUTHINFO' ? `${command} ${sub}` : command);
        if (command === 'AUTHINFO' && sub === 'USER') {
          selectedUser = rest.join(' '); send(mode === 'anonymous' ? '281 Anonymous success' : '381 Password required');
        } else if (command === 'AUTHINFO' && sub === 'PASS') {
          authenticated = (selectedUser === 'Alice' && rest.join(' ') === 'synthetic-a') ||
            (selectedUser === 'Bob' && rest.join(' ') === 'synthetic-b');
          send(authenticated ? '281 Accepted' : '481 Rejected');
        } else if (!authenticated) send('480 Authenticate');
        else if (command === 'LIST') {
          send('215 Active groups');
          if (mode === 'oversize') { send('x'.repeat(8193)); continue; }
          send('welcome 3 1 n'); if (selectedUser === 'Alice') send('workshop 3 1 n'); send('.');
        } else if (command === 'GROUP') {
          group = sub;
          send(group === 'welcome' || (group === 'workshop' && selectedUser === 'Alice') ? `211 3 1 3 ${group}` : '411 No group');
        } else if (command === 'XOVER') {
          const [lo, hi] = sub.split('-').map(Number); send('224 Overview');
          for (let n = lo; n <= hi; n++) send(`${n}\tSubject ${n}\tTest author\tDate\t<${n}@test>\t\t100\t2`);
          send('.');
        } else if (command === 'ARTICLE') { send(`220 ${sub} <${sub}@test>`); send('Subject: Synthetic'); send(''); send('..literal dot'); send('.'); }
        else send('500 Unsupported');
      }
    });
  });
  server.on('tlsClientError', () => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  return { endpoint: { host: '127.0.0.1', port: server.address().port, servername: 'localhost', ca: cert }, commands };
}

test('TLS authentication binds separate users to separate read-only native connections', async t => {
  const { endpoint, commands } = await fixture(t);
  const alice = await NntpsSession.login(endpoint, 'Alice', 'synthetic-a');
  const bob = await NntpsSession.login(endpoint, 'Bob', 'synthetic-b');
  t.after(() => { alice.close(); bob.close(); });
  assert.deepEqual(await alice.groups(), ['welcome', 'workshop']);
  assert.deepEqual(await bob.groups(), ['welcome']);
  const first = await alice.overview('workshop', undefined, 2);
  assert.deepEqual(first.lines.map(s => Number(s.split('\t')[0])), [2, 3]);
  assert.equal(first.nextBefore, 2);
  assert.deepEqual((await alice.overview('workshop', first.nextBefore, 2)).lines.map(s => Number(s.split('\t')[0])), [1]);
  assert.deepEqual(await alice.article('workshop', 3), ['Subject: Synthetic', '', '.literal dot']);
  await assert.rejects(bob.article('workshop', 3), { message: 'Secure Mystic connection unavailable' });
  assert.deepEqual(await alice.groups(), ['welcome', 'workshop']);
  assert.ok(commands.every(s => ['AUTHINFO USER', 'AUTHINFO PASS', 'LIST', 'GROUP', 'XOVER', 'ARTICLE'].includes(s)));
});

test('crossed passwords, unknown users, and command injection never authenticate', async t => {
  const { endpoint, commands } = await fixture(t);
  await assert.rejects(NntpsSession.login(endpoint, 'Bob', 'synthetic-a'));
  await assert.rejects(NntpsSession.login(endpoint, 'Missing', 'synthetic-a'));
  const before = commands.length;
  await assert.rejects(NntpsSession.login(endpoint, 'Bob\r\nPOST', 'synthetic-b'));
  await assert.rejects(NntpsSession.login(endpoint, 'Bob', 'synthetic-b\r\nPOST'));
  assert.equal(commands.length, before);
});

test('wrong certificate identity or untrusted CA prevents all AUTHINFO commands', async t => {
  const { endpoint, commands } = await fixture(t);
  await assert.rejects(NntpsSession.login({ ...endpoint, servername: 'wrong.example' }, 'Alice', 'synthetic-a'));
  await assert.rejects(NntpsSession.login({ ...endpoint, ca: Buffer.from('untrusted') }, 'Alice', 'synthetic-a'));
  assert.deepEqual(commands, []);
});

test('anonymous success is not treated as verification of the supplied password', async t => {
  const { endpoint, commands } = await fixture(t, 'anonymous');
  await assert.rejects(NntpsSession.login(endpoint, 'Alice', 'synthetic-a'));
  assert.deepEqual(commands, ['AUTHINFO USER']);
});

test('oversized native lines close the connection and disclose no partial group list', async t => {
  const { endpoint } = await fixture(t, 'oversize');
  const session = await NntpsSession.login(endpoint, 'Alice', 'synthetic-a');
  t.after(() => session.close());
  await assert.rejects(session.groups());
  await assert.rejects(session.groups());
});
