const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/lib/auth/application-security.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded.require = id => {
  if (id === 'server-only') return {};
  if (id === './store') return { AuthStore: class {} };
  if (id === './native') return { NativeAccessError: class NativeAccessError extends Error {} };
  return require(id);
};
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { ApplicationSecurity, validResource } = loaded.exports;
const revision = 'a'.repeat(64);
const identity = { instance: 'sandbox', userId: 1 };

test('central authorization rejects malformed and unknown resource requests', () => {
  assert.equal(validResource({ resource: 'message-area', resourceId: 23, action: 'read', catalogRevision: revision }), true);
  assert.equal(validResource({ resource: 'administration', action: 'access', catalogRevision: revision }), true);
  for (const invalid of [
    null, {}, { resource: 'message-area', resourceId: 0, action: 'read', catalogRevision: revision },
    { resource: 'message-area', resourceId: 1, action: 'delete', catalogRevision: revision },
    { resource: 'message-area', resourceId: 1, action: 'read', catalogRevision: revision, allowed: true },
    { resource: 'profile', resourceId: 1, action: 'edit', catalogRevision: 'wrong' },
    { resource: 'administration', resourceId: 1, action: 'access', catalogRevision: revision },
    { resource: '__proto__', action: 'access', catalogRevision: revision },
  ]) assert.equal(validResource(invalid), false);
});

test('central authorization denies unsupported actions even for valid accounts', async () => {
  let accountCalls = 0;
  const native = {
    accountValid: async () => { accountCalls++; return true; },
    readArea: async (_identity, _id, _rev, read) => read(),
  };
  const security = new ApplicationSecurity(native, '/unused');
  assert.equal(await security.authorize(identity, {
    resource: 'file-area', resourceId: 2, action: 'download', catalogRevision: revision,
  }), false);
  assert.equal(await security.authorize(identity, {
    resource: 'message-area', resourceId: 2, action: 'post', catalogRevision: revision,
  }), false);
  assert.equal(await security.authorize(identity, {
    resource: 'message-area', resourceId: 2, action: 'read', catalogRevision: revision,
  }), true);
  assert.equal(accountCalls, 3);
});

test('central authorization fails closed when native account is unavailable', async () => {
  let reads = 0;
  const security = new ApplicationSecurity({
    accountValid: async () => false,
    readArea: async () => { reads++; },
  }, '/unused');
  assert.equal(await security.authorize(identity, {
    resource: 'message-area', resourceId: 2, action: 'read', catalogRevision: revision,
  }), false);
  assert.equal(reads, 0);
});
