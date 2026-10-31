const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Server, utils } = require('ssh2');
const filename = path.resolve(__dirname, '../src/lib/auth/ssh-session.ts');
const mod = new Module(filename, module);
mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
const original = mod.require.bind(mod);
mod.require = id => id === 'server-only' ? {} : original(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { NativeSshSession } = mod.exports;

async function fixture(t, mode = '') {
  const key = utils.generateKeyPairSync('ed25519');
  const publicKey = utils.parseKey(key.private).getPublicSSH();
  const connections = new Set();
  let authAttempts = 0;
  const server = new Server({ hostKeys: [key.private],
    ...(mode === 'legacy' ? { algorithms: { cipher: ['aes256-cbc'] } } : {}),
  }, connection => {
    connections.add(connection);
    connection.on('error', () => {});
    connection.on('close', () => connections.delete(connection));
    connection.on('authentication', context => {
      authAttempts++;
      if (context.method === 'password' && context.username === 'fixture' && context.password === 'synthetic') context.accept();
      else context.reject();
    });
    connection.on('ready', () => connection.on('session', accept => {
      const session = accept();
      session.on('pty', acceptPty => acceptPty());
      session.on('shell', acceptShell => {
        const stream = acceptShell();
        stream.on('error', () => {});
        if (mode !== 'no-bridge') stream.write('MYSTICWEB/1 READY\r\n');
        let input = '';
        stream.on('data', bytes => {
          input += bytes.toString('utf8');
          if (!input.includes('\n')) return;
          const request = JSON.parse(input); input = '';
          if (mode === 'stalled') return;
          if (mode === 'oversized') { stream.write('x'.repeat(9000)); return; }
          const reply = { nonce: mode === 'wrong-nonce' ? 'X'.repeat(43) : request.nonce, fixture: true };
          stream.write('MYSTICWEB/1 ' + JSON.stringify(reply) + '\r\n');
        });
      });
    }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { for (const connection of connections) connection.end(); server.close(); server.unref(); });
  return {
    endpoint: { host: '127.0.0.1', port: server.address().port,
      hostKeySha256: createHash('sha256').update(publicKey).digest('hex') },
    attempts: () => authAttempts,
  };
}

test('pinned SSH authenticates, waits for native worker and carries nonce-bound metadata', async t => {
  const f = await fixture(t);
  const session = await NativeSshSession.connect(f.endpoint, 'fixture', 'synthetic', new AbortController().signal);
  t.after(() => session.close());
  const reply = await session.request({ nonce: 'N'.repeat(43), operation: 'account' }, new AbortController().signal);
  assert.deepEqual(reply, { nonce: 'N'.repeat(43), fixture: true });
  assert.equal(f.attempts(), 1);
  await assert.rejects(session.request({ nonce: 'N'.repeat(43), password: 'never-send' }, new AbortController().signal));
});

test('wrong host pin prevents any credential authentication attempt', async t => {
  const f = await fixture(t);
  await assert.rejects(NativeSshSession.connect({ ...f.endpoint, hostKeySha256: '0'.repeat(64) },
    'fixture', 'synthetic', new AbortController().signal), error => error.stage === 'HOST_KEY');
  assert.equal(f.attempts(), 0);
});

test('legacy compatibility must be explicit and is restricted to literal loopback', async t => {
  const f = await fixture(t, 'legacy');
  await assert.rejects(NativeSshSession.connect(f.endpoint, 'fixture', 'synthetic', new AbortController().signal));
  assert.equal(f.attempts(), 0);
  await assert.rejects(NativeSshSession.connect({ ...f.endpoint, host: '192.0.2.1', localCompatibility: 'aes256-cbc' },
    'fixture', 'synthetic', new AbortController().signal), error => error.stage === 'CONNECT');
  const session = await NativeSshSession.connect({ ...f.endpoint, localCompatibility: 'aes256-cbc' },
    'fixture', 'synthetic', new AbortController().signal);
  t.after(() => session.close());
  assert.equal(f.attempts(), 1);
  const result = await session.request({ nonce: 'N'.repeat(43) }, new AbortController().signal);
  assert.equal(result.fixture, true);
});

test('wrong password does not produce a native session and is not exposed in errors', async t => {
  const f = await fixture(t);
  await assert.rejects(NativeSshSession.connect(f.endpoint, 'fixture', 'synthetic-wrong', new AbortController().signal),
    error => error.stage === 'AUTHENTICATE' && !String(error).includes('synthetic'));
});

test('SSH authentication without native READY is not an established bridge', async t => {
  const f = await fixture(t, 'no-bridge');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600);
  try { await assert.rejects(NativeSshSession.connect(f.endpoint, 'fixture', 'synthetic', controller.signal)); }
  finally { clearTimeout(timeout); }
});

for (const mode of ['wrong-nonce', 'oversized', 'stalled']) {
  test('native reply ' + mode + ' closes the connection', async t => {
    const f = await fixture(t, mode);
    const session = await NativeSshSession.connect(f.endpoint, 'fixture', 'synthetic', new AbortController().signal);
    t.after(() => session.close());
    await assert.rejects(session.request({ nonce: 'N'.repeat(43), operation: 'account' }, new AbortController().signal));
    await assert.rejects(session.request({ nonce: 'N'.repeat(43) }, new AbortController().signal));
  });
}
