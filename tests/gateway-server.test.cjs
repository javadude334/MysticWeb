const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const Module = require('node:module');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src/lib/auth/' + relative);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : (Object.hasOwn(dependencies, id) ? dependencies[id] : original(id));
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const native = load('native.ts');
const { createGatewayServer, parseGatewayRequest } = load('gateway-server.ts', { './native': native });
let directory, ca, cert, key, clientCert, clientKey;
before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mystic-gateway-server-'));
  const openssl = ['C:/DevApps/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/usr/bin/openssl.exe'].find(p => fs.existsSync(p)) || 'openssl';
  const run = args => assert.equal(spawnSync(openssl, args, { cwd: directory, stdio: 'ignore' }).status, 0);
  fs.writeFileSync(path.join(directory, 'ca.cnf'), '[req]\ndistinguished_name=dn\nx509_extensions=ca\n[dn]\nCN=Fixture CA\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n');
  fs.writeFileSync(path.join(directory, 'request.cnf'), '[req]\ndistinguished_name=dn\n[dn]\nCN=Fixture\n');
  run(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1',
    '-config', 'ca.cnf', '-subj', '/CN=Fixture CA', '-keyout', 'ca.key', '-out', 'ca.pem']);
  for (const role of ['server', 'client']) {
    run(['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-config', 'request.cnf',
      '-subj', '/CN=' + role, '-keyout', role + '.key', '-out', role + '.csr']);
    fs.writeFileSync(path.join(directory, role + '.ext'), 'basicConstraints=critical,CA:FALSE\nextendedKeyUsage=' + role + 'Auth\n' +
      (role === 'server' ? 'subjectAltName=IP:127.0.0.1\n' : ''));
    run(['x509', '-req', '-in', role + '.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-days', '1',
      '-extfile', role + '.ext', '-out', role + '.pem']);
  }
  ca = fs.readFileSync(path.join(directory, 'ca.pem'));
  cert = fs.readFileSync(path.join(directory, 'server.pem')); key = fs.readFileSync(path.join(directory, 'server.key'));
  clientCert = fs.readFileSync(path.join(directory, 'client.pem')); clientKey = fs.readFileSync(path.join(directory, 'client.key'));
});
after(() => {
  if (!directory) return;
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'mystic-gateway-server-'));
  key?.fill(0); clientKey?.fill(0);
  fs.rmSync(directory, { recursive: true, force: true });
});
const account = { exists: true, deleted: false, locked: false, expired: false, passwordChangeRequired: false };
const requestBody = (extra = {}) => ({ version: 1, instance: 'sandbox', nonce: 'N'.repeat(43), operation: 'account', userId: 2, ...extra });
async function fixture(t, provider = null, allowedClient = '127.0.0.1') {
  const server = createGatewayServer({ instance: 'sandbox', allowedClient, tls: { ca, cert, key }, provider });
  const sockets = new Set();
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { for (const socket of sockets) socket.destroy(); server.close(); server.unref(); });
  return (body, options = {}) => new Promise((resolve, reject) => {
    const bytes = body === undefined ? undefined : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const req = https.request({ hostname: '127.0.0.1', port: server.address().port, ca, rejectUnauthorized: true,
      ...(options.anonymous ? {} : { cert: clientCert, key: clientKey }),
      path: body === undefined ? '/health' : '/v1/native', method: body === undefined ? 'GET' : 'POST', agent: false,
      headers: bytes ? { 'content-type': 'application/json', 'content-length': bytes.length } : {},
    }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(4000, () => req.destroy(new Error('Fixture client timeout')));
    req.on('error', reject); req.end(bytes);
  });
}

test('mTLS health is separate from native authentication readiness', async t => {
  const call = await fixture(t);
  const health = await call();
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.text), { status: 'ok', nativeAccess: 'unverified' });
  const login = await call(requestBody({ operation: 'authenticate', userId: undefined, username: 'fixture', password: 'synthetic' }));
  assert.equal(login.status, 503);
  assert.ok(!login.text.includes('synthetic'));
});
test('missing client certificate and wrong source IP cannot reach the provider', async t => {
  let calls = 0;
  const provider = { request: async () => { calls++; return {}; } };
  const call = await fixture(t, provider);
  await assert.rejects(call(undefined, { anonymous: true }));
  const forbidden = await fixture(t, provider, '192.0.2.1');
  assert.equal((await forbidden(requestBody())).status, 403);
  assert.equal(calls, 0);
});
test('replays and invalid native replies cannot disclose raw records or credentials', async t => {
  let calls = 0;
  const call = await fixture(t, { request: async req => { calls++; return { ...req, account, rawRecord: 'SECRET' }; } });
  const denied = await call(requestBody());
  assert.equal(denied.status, 403); assert.ok(!denied.text.includes('SECRET'));
  assert.equal((await call(requestBody())).status, 403); assert.equal(calls, 1);
});
test('exact validated native replies pass over the authenticated channel', async t => {
  const call = await fixture(t, { request: async req => ({ ...req, account }) });
  const result = await call(requestBody());
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.text), { ...requestBody(), account });
});
test('stalled provider is cancelled at the server deadline', async t => {
  let cancelled = false;
  const call = await fixture(t, { request: async (_req, { signal }) => {
    signal.addEventListener('abort', () => { cancelled = true; }, { once: true });
    return new Promise(() => {});
  } });
  await assert.rejects(call(requestBody()));
  assert.equal(cancelled, true);
});
test('flat request parser rejects duplicate decoded names and malformed operations', () => {
  assert.ok(parseGatewayRequest(JSON.stringify(requestBody()), 'sandbox'));
  const repeated = JSON.stringify(requestBody()).replace('"userId":2', '"userId":2,"user\\u0049d":1');
  assert.equal(parseGatewayRequest(repeated, 'sandbox'), null);
  assert.equal(parseGatewayRequest(JSON.stringify(requestBody({ userId: true })), 'sandbox'), null);
  assert.equal(parseGatewayRequest(JSON.stringify(requestBody({ instance: 'other' })), 'sandbox'), null);
  assert.equal(parseGatewayRequest(JSON.stringify(requestBody({ operation: 'execute' })), 'sandbox'), null);
});
