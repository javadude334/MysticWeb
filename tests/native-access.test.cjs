const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/auth/native.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const original = loaded.require.bind(loaded);
loaded.require = id => id === 'server-only' ? {} : original(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const { NativeAccess, NativeAccessError } = loaded.exports;
const identity = { instance: 'vm', userId: 42 };
const revision = 'a'.repeat(64);
const account = () => ({ exists: true, deleted: false, locked: false, expired: false, passwordChangeRequired: false });
const permissions = () => ({ list: true, read: true, group: true, context: true, kind: 'echo', private: false, personal: false });
function response(request) {
  const result = { version: 1, nonce: request.nonce, operation: request.operation, instance: request.instance, userId: 42, account: account() };
  if (request.operation === 'authenticate') result.passwordVerified = true;
  if (request.operation === 'authorize') Object.assign(result, { areaId: request.areaId, catalogRevision: request.catalogRevision, permissions: permissions() });
  return result;
}
function provider(transform = value => value) {
  return { request: async request => transform(response(request), request) };
}

test('missing native provider denies login, account validation and all storage access', async () => {
  const gate = new NativeAccess(null, 'vm');
  assert.equal(await gate.authenticate('Test User', 'synthetic'), null);
  assert.equal(await gate.accountValid(identity), false);
  let read = false;
  await assert.rejects(gate.readArea(identity, 1, revision, async () => { read = true; }), NativeAccessError);
  assert.equal(read, false);
});

test('native password verification returns only permanent instance-scoped identity', async () => {
  const nonces = [];
  const gate = new NativeAccess(provider((reply, request) => {
    assert.equal(request.username, 'Test User');
    assert.equal(request.password, ' synthetic password ');
    assert.match(request.nonce, /^[A-Za-z0-9_-]{43}$/);
    nonces.push(request.nonce);
    return reply;
  }), 'vm');
  assert.deepEqual(await gate.authenticate('Test User', ' synthetic password '), identity);
  assert.deepEqual(await gate.authenticate('Test User', ' synthetic password '), identity);
  assert.notEqual(nonces[0], nonces[1]);
});

test('unverified passwords, raw native records and mismatched replies fail closed', async () => {
  for (const change of [
    { passwordVerified: false }, { passwordVerified: 'true' }, { nonce: 'replayed' },
    { version: 2 }, { instance: 'local' }, { operation: 'account' }, { userId: 0 },
    { userId: '42' }, { userId: 0xffffffff }, { pwdata: 'synthetic secret' },
  ]) {
    const gate = new NativeAccess(provider(reply => ({ ...reply, ...change })), 'vm');
    assert.equal(await gate.authenticate('Test User', 'synthetic'), null);
  }
});

test('missing, locked, deleted, expired and password-change accounts cannot authenticate', async () => {
  for (const key of Object.keys(account())) {
    const gate = new NativeAccess(provider(reply => ({ ...reply, account: { ...account(), [key]: key === 'exists' ? false : true } })), 'vm');
    assert.equal(await gate.authenticate('Test User', 'synthetic'), null);
    assert.equal(await gate.accountValid(identity), false);
  }
  assert.equal(await new NativeAccess(provider(reply => ({ ...reply, account: {} })), 'vm').accountValid(identity), false);
});

test('identity, area and configuration are bound to every native permission decision', async () => {
  for (const change of [{ userId: 43 }, { areaId: 2 }, { catalogRevision: 'b'.repeat(64) }, { nonce: 'old' }]) {
    let reads = 0;
    const gate = new NativeAccess(provider(reply => ({ ...reply, ...change })), 'vm');
    await assert.rejects(gate.readArea(identity, 1, revision, async () => ++reads), NativeAccessError);
    assert.equal(reads, 0);
  }
  const gate = new NativeAccess(provider(), 'vm');
  assert.equal(await gate.accountValid({ instance: 'local', userId: 42 }), false);
  assert.equal(await gate.accountValid({ instance: 'vm', userId: 43 }), false);
  for (const area of [0, -1, 1.5, 65536, '../secret']) await assert.rejects(gate.readArea(identity, area, revision, async () => 1), NativeAccessError);
});

test('only verified echo areas with all native read and group checks may reach storage', async () => {
  for (const change of [
    { list: false }, { read: false }, { group: false }, { context: false },
    { private: true }, { personal: true }, { kind: 'netmail' }, { kind: 'local' },
    { kind: 'personal' }, { kind: 'news' }, { kind: 'unknown' }, { read: 'true' },
    { inferredGroupId: 7 },
  ]) {
    let reads = 0;
    const gate = new NativeAccess(provider(reply => ({ ...reply, permissions: { ...permissions(), ...change } })), 'vm');
    await assert.rejects(gate.readArea(identity, 1, revision, async () => ++reads), NativeAccessError);
    assert.equal(reads, 0);
  }
  assert.equal(await new NativeAccess(provider(), 'vm').readArea(identity, 1, revision, async () => 'synthetic body'), 'synthetic body');
});

test('revocation or permission changes are checked again instead of using cached allow results', async () => {
  let deleted = false, readAllowed = true, calls = 0, reads = 0;
  const gate = new NativeAccess(provider(reply => {
    calls++;
    return { ...reply, account: { ...account(), deleted }, permissions: { ...permissions(), read: readAllowed } };
  }), 'vm');
  assert.equal(await gate.readArea(identity, 1, revision, async () => ++reads), 1);
  deleted = true;
  await assert.rejects(gate.readArea(identity, 1, revision, async () => ++reads), NativeAccessError);
  deleted = false; readAllowed = false;
  await assert.rejects(gate.readArea(identity, 1, revision, async () => ++reads), NativeAccessError);
  assert.equal(calls, 3); assert.equal(reads, 1);
});

test('native failures, timeouts and storage errors do not leak credentials or paths', async () => {
  const bad = new NativeAccess({ request: async () => { throw new Error('synthetic password and path'); } }, 'vm');
  assert.equal(await bad.authenticate('Test User', 'synthetic'), null);
  let signal;
  const stalled = new NativeAccess({ request: (_, options) => { signal = options.signal; return new Promise(() => {}); } }, 'vm', 20);
  assert.equal(await stalled.accountValid(identity), false);
  assert.equal(signal.aborted, true);
  const gate = new NativeAccess(provider(), 'vm');
  await assert.rejects(gate.readArea(identity, 1, revision, async () => { throw new Error('/synthetic/private/path'); }),
    error => error instanceof NativeAccessError && !error.message.includes('/synthetic'));
});

test('invalid credential framing is rejected before calling the native provider', async () => {
  let calls = 0;
  const gate = new NativeAccess({ request: async () => { calls++; return null; } }, 'vm');
  for (const [name, password] of [['', 'test'], ['user', ''], ['user\0other', 'test'], ['user', 'x\r\ny'], ['a'.repeat(121), 'test'], ['user', 'p'.repeat(257)]]) {
    assert.equal(await gate.authenticate(name, password), null);
  }
  assert.equal(calls, 0);
});
