const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '../src/lib', file + '.ts');
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : id.startsWith('.') ?
    load(path.relative(path.resolve(__dirname, '../src/lib'), path.resolve(path.dirname(filename), id)).replaceAll('\\', '/')) : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const { AuthStore } = load('auth/store');
const { NativeAccess } = load('auth/native');
const { WebAccess, productionAccess } = load('auth/service');
const { MessageReader, numericId, catalogRevision } = load('mystic/reader');
const { BridgeTransport } = load('auth/transport');
const revision = 'a'.repeat(64);
function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mystic-web-'));
  fs.chmodSync(dir, 0o700);
  const store = new AuthStore(path.join(dir, 'auth.sqlite'));
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const state = { disabled: false, expired: false, denied: false, malformed: false, calls: 0, reads: 0, changed: false };
  const native = new NativeAccess({ request: async req => {
    state.calls++;
    if (state.malformed) return { passwordVerified: true };
    if (req.operation === 'authenticate' && req.password !== 'synthetic') return null;
    const userId = req.operation === 'authenticate' ? (req.username === 'alice' ? 42 : 43) : req.userId;
    const reply = { version: 1, nonce: req.nonce, operation: req.operation, instance: 'vm', userId,
      account: { exists: true, deleted: false, locked: state.disabled, expired: state.expired, passwordChangeRequired: false } };
    if (req.operation === 'authenticate') reply.passwordVerified = true;
    if (req.operation === 'authorize') Object.assign(reply, { areaId: req.areaId, catalogRevision: req.catalogRevision,
      permissions: { list: !state.denied, read: !state.denied && userId === 42, group: true, context: true, kind: 'echo', private: false, personal: false } });
    return reply;
  } }, 'vm');
  const reader = new MessageReader(native, async () => ({ revision: state.changed ? 'b'.repeat(64) : revision,
    areas: [{ id: 1, name: 'Board', jamBase: 'echo' }] }), dir, async (_, base, opts) => {
    state.reads++;
    assert.equal(base, 'echo');
    return { messages: [{ number: opts.message || 9, author: 'Test', recipient: 'All', subject: '<script>',
      dates: { written: 0, received: 0, processed: 0, timezone: null }, attributes: 0, messageId: 'hidden metadata',
      ...(opts.message ? { body: '<b>plain text</b>' } : {}) }], nextBefore: opts.message ? null : 9, scanned: 1, skipped: 0 };
  });
  const app = new WebAccess(store, native, reader, 'https://bbs.example', Buffer.alloc(32, 7), () => 'trusted-test-peer');
  return { store, native, reader, app, state };
}
function request(url, token, method = 'GET', body) {
  return new Request('https://bbs.example' + url, { method,
    headers: { origin: 'https://bbs.example', 'content-type': 'application/json', ...(token ? { cookie: '__Host-mysticweb_session=' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function login(app, name = 'alice', password = 'synthetic', old) {
  return app.login(request('/api/auth/login', old, 'POST', { username: name, password }));
}
function token(response) { return response.headers.get('set-cookie')?.split(';')[0].split('=')[1]; }

test('production has no activation flag or default provider', () => assert.equal(productionAccess(), null));
test('bad credentials, disabled/expired accounts and malformed replies create no session', async t => {
  const { app, state } = setup(t);
  assert.equal((await login(app, 'alice', 'wrong')).status, 401);
  state.disabled = true; assert.equal((await login(app)).status, 401);
  state.disabled = false; state.expired = true; assert.equal((await login(app)).status, 401);
  state.expired = false; state.malformed = true;
  const result = await login(app);
  assert.equal(result.status, 401); assert.equal(token(result), undefined);
});
test('login rotates persistent sessions; logout revokes; cookies and reads are private', async t => {
  const { app, store } = setup(t);
  const first = await login(app), old = token(first);
  assert.match(first.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Strict/);
  const next = await login(app, 'alice', 'synthetic', old), current = token(next);
  assert.notEqual(current, old); assert.equal(store.read(old), null);
  const result = await app.read(request('/api/messages?area=1&limit=2', current));
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'private, no-store');
  const data = await result.json();
  assert.equal(data.nextBefore, 9); assert.equal(data.messages[0].body, undefined);
  assert.equal(data.messages[0].messageId, undefined);
  const direct = await app.read(request('/api/messages?area=1&message=9', current));
  assert.equal((await direct.json()).messages[0].body, '<b>plain text</b>');
  assert.equal((await app.logout(request('/api/auth/logout', current, 'POST'))).status, 200);
  assert.equal(store.read(current), null);
});
test('session isolation and denied ListACS/ReadACS never touch storage or leak area metadata', async t => {
  const { app, state } = setup(t);
  const alice = token(await login(app)), bob = token(await login(app, 'bob'));
  assert.equal((await app.read(request('/api/messages?area=1', alice))).status, 200);
  assert.equal((await app.read(request('/api/messages?area=1', bob))).status, 404);
  assert.deepEqual(await (await app.read(request('/api/messages', bob))).json(), { areas: [] });
  state.denied = true;
  assert.equal((await app.read(request('/api/messages?area=1', alice))).status, 404);
  assert.equal(state.reads, 1);
});
test('current invalid account revokes all its sessions without revoking another account', async t => {
  const { app, state, store } = setup(t);
  const a = token(await login(app)), a2 = token(await login(app)), b = token(await login(app, 'bob'));
  state.disabled = true;
  assert.equal((await app.read(request('/api/messages?area=1', a))).status, 401);
  assert.equal(store.read(a2), null);
  assert.deepEqual(store.read(b), { instance: 'vm', userId: 43 });
  assert.equal(state.reads, 0);
});
test('traversal, duplicate/unknown parameters and invalid pagination fail before storage', async t => {
  const { app, state } = setup(t);
  const current = token(await login(app));
  for (const query of ['area=../secret', 'area=1&area=2', 'base=echo', 'area=1&limit=51', 'area=1&before=0',
    'area=1&message=2&before=3', 'area=01', 'area=65536', 'area=1&message=4294967296']) {
    assert.equal((await app.read(request('/api/messages?' + query, current))).status, 404, query);
  }
  assert.equal(state.reads, 0);
  for (const value of ['../x', '1.1', '-1', '0', '01', '1e2', '1\n']) assert.throws(() => numericId(value));
});
test('CSRF, oversized input and account throttling deny before native work', async t => {
  const { app, state } = setup(t);
  const evil = new Request('https://bbs.example/api/auth/login', { method: 'POST',
    headers: { origin: 'https://evil.example' }, body: 'credentials' });
  assert.equal((await app.login(evil)).status, 403);
  assert.equal((await login(app, 'alice', 'p'.repeat(3000))).status, 503);
  assert.equal(state.calls, 0);
  for (let i = 0; i < 5; i++) assert.equal((await login(app, 'alice', 'wrong')).status, 401);
  assert.equal((await login(app)).status, 429); assert.equal(state.calls, 5);
});
test('catalog revision hashing is deterministic and length/order bound', () => {
  assert.equal(catalogRevision(Buffer.from('a'), Buffer.from('bc')), catalogRevision(Buffer.from('a'), Buffer.from('bc')));
  assert.notEqual(catalogRevision(Buffer.from('a'), Buffer.from('bc')), catalogRevision(Buffer.from('ab'), Buffer.from('c')));
});
test('transport rejects insecure endpoints and refuses aborted work', async () => {
  const tls = { ca: Buffer.from('test'), cert: Buffer.from('test'), key: Buffer.from('test') };
  for (const url of ['http://localhost/v1/native', 'https://user:pw@localhost/v1/native', 'https://localhost/other', 'https://localhost/v1/native?x=y'])
    assert.throws(() => new BridgeTransport(url, tls));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new BridgeTransport('https://localhost/v1/native', tls).request({}, { signal: controller.signal }), /Bridge unavailable/);
});

test('invalid catalog mapping and catalog changes cannot disclose storage results', async t => {
  const { native } = setup(t);
  const identity = { instance: 'vm', userId: 42 };
  let reads = 0;
  const invalid = new MessageReader(native, async () => ({ revision, areas: [{ id: 1, name: 'Board', jamBase: '../secret' }] }), '/unused', async () => { reads++; });
  await assert.rejects(invalid.read(identity, 1, {}));
  assert.equal(reads, 0);
  let changed = false;
  const race = new MessageReader(native, async () => ({ revision: changed ? 'b'.repeat(64) : revision, areas: [{ id: 1, name: 'Board', jamBase: 'echo' }] }), '/unused', async () => { changed = true; return { messages: [], nextBefore: null }; });
  await assert.rejects(race.read(identity, 1, {}));
});
test('forged and ambiguous session cookies cannot reach native work', async t => {
  const { app, state } = setup(t);
  assert.equal((await app.read(request('/api/messages?area=1', 'forged'))).status, 401);
  const valid = token(await login(app));
  const calls = state.calls;
  const req = request('/api/messages?area=1', valid);
  req.headers.set('cookie', '__Host-mysticweb_session=' + valid + '; __Host-mysticweb_session=' + valid);
  assert.equal((await app.read(req)).status, 401);
  assert.equal(state.calls, calls);
});
