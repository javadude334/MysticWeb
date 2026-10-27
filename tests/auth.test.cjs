const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

function load(name) {
  const filename = path.resolve(__dirname, `../src/lib/auth/${name}.ts`);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const { AuthStore, AuthStoreError, rateBucket } = load('store');
const { authCookie, allowAuthMutation } = load('http');
const identity = { instance: 'mystic-vm', userId: 42 };
const bucket = 'a'.repeat(64);

function directory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mystic-auth-'));
  fs.chmodSync(dir, 0o700);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

if (process.env.MYSTIC_AUTH_TEST_CHILD) {
  const store = new AuthStore(process.env.MYSTIC_AUTH_TEST_CHILD, () => 1000);
  process.stdout.write(JSON.stringify(store.consume(bucket, 2, 60000)));
  store.close();
} else {
  test('persists hashed tokens across restart without granting stored permissions', t => {
    const filename = path.join(directory(t), 'auth.sqlite');
    let store = new AuthStore(filename);
    const token = store.create(identity);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    store.close();
    const db = new DatabaseSync(filename, { readOnly: true });
    const row = db.prepare('SELECT * FROM sessions').get();
    assert.match(row.digest, /^[a-f0-9]{64}$/);
    assert.notEqual(row.digest, token);
    assert.equal(Object.values(row).includes(token), false);
    assert.equal(fs.readFileSync(filename).includes(Buffer.from(token)), false);
    db.close();
    store = new AuthStore(filename);
    try { assert.deepEqual(store.read(token), identity); }
    finally { store.close(); }
  });

  test('expires idle sessions at the boundary and never revives them', t => {
    let now = 1000;
    const store = new AuthStore(path.join(directory(t), 'auth.sqlite'), () => now);
    try {
      const token = store.create(identity);
      now += 30 * 60 * 1000;
      assert.equal(store.read(token), null);
      now = 1000;
      assert.equal(store.read(token), null);
    } finally { store.close(); }
  });

  test('activity cannot extend absolute expiry; backwards clock revokes sessions', t => {
    let now = 1000;
    const store = new AuthStore(path.join(directory(t), 'auth.sqlite'), () => now);
    try {
      const token = store.create(identity);
      for (let i = 1; i < 32; i++) {
        now = 1000 + i * 15 * 60 * 1000;
        assert.deepEqual(store.read(token), identity);
      }
      now = 1000 + 8 * 60 * 60 * 1000;
      assert.equal(store.read(token), null);
      const another = store.create(identity);
      now--;
      assert.equal(store.read(another), null);
    } finally { store.close(); }
  });

  test('rotation and logout invalidate old tokens; instance-specific account revocation works', t => {
    const store = new AuthStore(path.join(directory(t), 'auth.sqlite'));
    try {
      const original = store.create(identity);
      const replacement = store.create(identity, original);
      assert.notEqual(original, replacement);
      assert.equal(store.read(original), null);
      assert.deepEqual(store.read(replacement), identity);
      const other = { instance: 'mystic-local', userId: 42 };
      const otherToken = store.create(other);
      store.revokeIdentity(identity);
      assert.equal(store.read(replacement), null);
      assert.deepEqual(store.read(otherToken), other);
      store.revoke(otherToken);
      store.revoke(otherToken);
      assert.equal(store.read(otherToken), null);
    } finally { store.close(); }
  });

  test('invalid identities, forged tokens and unavailable stores fail closed without paths', t => {
    const dir = directory(t);
    const filename = path.join(dir, 'auth.sqlite');
    const store = new AuthStore(filename);
    try {
      for (const item of [{ instance: '', userId: 1 }, { instance: '../vm', userId: 1 }, { instance: 'vm', userId: -1 }, { instance: 'vm', userId: 1.5 }]) {
        assert.throws(() => store.create(item), AuthStoreError);
      }
      for (const token of [undefined, '', 'bad', "' OR 1=1--", 'b'.repeat(43)]) assert.equal(store.read(token), null);
      store.close();
      assert.throws(() => store.read('b'.repeat(43)), error => error instanceof AuthStoreError && !error.message.includes(dir));
    } finally { /* already closed */ }
    assert.throws(() => new AuthStore('relative.sqlite'), AuthStoreError);
    assert.throws(() => new AuthStore(path.join(dir, 'missing', 'db')), AuthStoreError);
  });

  test('rate limits persist across separate app processes and do not extend the window', t => {
    const filename = path.join(directory(t), 'auth.sqlite');
    let now = 1000;
    const store = new AuthStore(filename, () => now);
    try {
      assert.deepEqual(store.consume(bucket, 2, 60000), { allowed: true, retryAfter: 0 });
      const child = () => {
        const result = spawnSync(process.execPath, [__filename], {
          env: { ...process.env, MYSTIC_AUTH_TEST_CHILD: filename }, encoding: 'utf8', timeout: 15000,
        });
        assert.equal(result.status, 0, result.stderr);
        return JSON.parse(result.stdout);
      };
      assert.equal(child().allowed, true);
      assert.equal(child().allowed, false);
      now += 1000;
      assert.deepEqual(store.consume(bucket, 2, 60000), { allowed: false, retryAfter: 59 });
      now = 61000;
      assert.equal(store.consume(bucket, 2, 60000).allowed, true);
      assert.throws(() => store.consume('raw-client-address', 2, 60000), AuthStoreError);
    } finally { store.close(); }
  });

  test('POSIX storage refuses broadly readable directories and database files', t => {
    if (process.platform === 'win32') { t.skip('Windows uses ACLs instead of POSIX mode bits'); return; }
    const dir = directory(t), filename = path.join(dir, 'auth.sqlite');
    fs.chmodSync(dir, 0o755);
    assert.throws(() => new AuthStore(filename), AuthStoreError);
    fs.chmodSync(dir, 0o700);
    fs.writeFileSync(filename, '', { mode: 0o644 });
    assert.throws(() => new AuthStore(filename), AuthStoreError);
  });

  test('auth mutations reject cross-origin, missing, malformed and untrusted Host origins', () => {
    const origin = 'https://davesbbs.com';
    assert.equal(allowAuthMutation('POST', new Headers({ origin }), origin), true);
    assert.equal(allowAuthMutation('POST', new Headers({ origin, 'sec-fetch-site': 'same-origin' }), origin), true);
    for (const supplied of ['https://evil.example', 'null', 'https://davesbbs.com.evil.example', 'http://davesbbs.com']) {
      assert.equal(allowAuthMutation('POST', new Headers({ origin: supplied }), origin), false);
    }
    assert.equal(allowAuthMutation('POST', new Headers({ host: 'davesbbs.com' }), origin), false);
    assert.equal(allowAuthMutation('POST', new Headers({ origin, 'sec-fetch-site': 'cross-site' }), origin), false);
    assert.equal(allowAuthMutation('GET', new Headers({ origin }), origin), false);
    assert.equal(allowAuthMutation('POST', new Headers({ origin }), 'http://davesbbs.com'), false);
    assert.equal(allowAuthMutation('POST', new Headers({ origin }), 'not-a-url'), false);
    assert.equal(allowAuthMutation('POST', new Headers({ origin }), origin + '/'), false);
  });

  test('session and clearing cookies are host-only, secure and inaccessible to scripts', () => {
    const cookie = authCookie('a'.repeat(43));
    assert.equal(cookie.name, '__Host-mysticweb_session');
    assert.equal(cookie.httpOnly, true); assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, 'strict'); assert.equal(cookie.path, '/');
    assert.equal(cookie.maxAge, 28800); assert.equal(cookie.domain, undefined);
    assert.equal(authCookie(null).maxAge, 0);
    assert.equal(authCookie(null).value, '');
    assert.throws(() => authCookie('user-selected-short-value'));
  });

  test('rate keys hide client identifiers and separate scopes and deployments', () => {
    const secret = Buffer.alloc(32, 1), address = '192.0.2.10';
    const key = rateBucket(secret, 'login-client', address);
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(key, rateBucket(secret, 'login-client', address));
    assert.notEqual(key, rateBucket(secret, 'login-account', address));
    assert.notEqual(key, rateBucket(Buffer.alloc(32, 2), 'login-client', address));
    assert.throws(() => rateBucket(Buffer.alloc(8), 'login-client', address), AuthStoreError);
  });

  test('failed rotation rolls back revocation and storage errors reveal no details', t => {
    const filename = path.join(directory(t), 'auth.sqlite');
    const store = new AuthStore(filename), db = new DatabaseSync(filename);
    try {
      const token = store.create(identity);
      db.exec("CREATE TRIGGER fail_insert BEFORE INSERT ON sessions BEGIN SELECT RAISE(FAIL, 'synthetic sensitive detail'); END;");
      assert.throws(() => store.create(identity, token), error => error instanceof AuthStoreError && !error.message.includes('sensitive'));
      assert.deepEqual(store.read(token), identity);
      db.exec('DROP TRIGGER fail_insert');
      db.exec('BEGIN IMMEDIATE');
      assert.throws(() => store.consume(bucket, 2, 60000), AuthStoreError);
      db.exec('ROLLBACK');
      assert.equal(store.consume(bucket, 2, 60000).allowed, true);
    } finally { db.close(); store.close(); }
  });

  test('session and bucket exhaustion fail closed and expired rows release capacity', t => {
    let now = 1000;
    const filename = path.join(directory(t), 'auth.sqlite');
    const store = new AuthStore(filename, () => now), db = new DatabaseSync(filename);
    try {
      db.exec('BEGIN');
      const session = db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)');
      const rate = db.prepare('INSERT INTO rate_limits VALUES (?, ?, ?)');
      for (let i = 0; i < 10000; i++) {
        const key = i.toString(16).padStart(64, '0');
        session.run(key, 'synthetic', 1, 1000, 1000, 60000);
        rate.run(key, 1, 60000);
      }
      db.exec('COMMIT');
      assert.throws(() => store.create(identity), AuthStoreError);
      assert.throws(() => store.consume(bucket, 2, 60000), AuthStoreError);
      now = 60000;
      assert.deepEqual(store.read(store.create(identity)), identity);
      assert.equal(store.consume(bucket, 2, 60000).allowed, true);
    } finally { db.close(); store.close(); }
  });
}
