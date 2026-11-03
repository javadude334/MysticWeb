const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/lib/auth/native.ts');
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
const original = mod.require.bind(mod);
mod.require = id => id === 'server-only' ? {} : original(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const { NativeAccess, NativeAccessError } = mod.exports;
const identity = { instance: 'test', userId: 42 };
const revision = 'a'.repeat(64);
const account = { exists: true, deleted: false, locked: false, expired: false, passwordChangeRequired: false };
const permissions = { list: true, read: true, group: true, context: true, kind: 'echo', private: false, personal: false };
function provider(reply) {
  return { request: async request => ({ version: 1, nonce: request.nonce, instance: request.instance,
    operation: request.operation, userId: request.userId ?? 42, account, ...(request.operation === 'authorize'
      ? { areaId: request.areaId, catalogRevision: request.catalogRevision, permissions } : {}),
    ...reply }) };
}
test('native area authorization grants only an exact, current permission response', async () => {
  const native = new NativeAccess(provider({}), 'test');
  assert.equal(await native.readArea(identity, 3, revision, async () => 'allowed'), 'allowed');
});
test('native area authorization fails closed for identity, account, revision and permissions', async () => {
  const cases = [
    [provider({ permissions: { ...permissions, private: true } }), identity, revision],
    [provider({ permissions: { ...permissions, read: false } }), identity, revision],
    [provider({ permissions: { ...permissions, group: false } }), identity, revision],
    [provider({ catalogRevision: 'b'.repeat(64) }), identity, revision],
    [provider({ account: { ...account, locked: true } }), identity, revision],
    [provider({ userId: 43 }), identity, revision],
    [provider({}), { instance: 'another', userId: 42 }, revision],
    [provider({}), identity, 'invalid']
  ];
  for (const [p, caller, rev] of cases) {
    const native = new NativeAccess(p, 'test');
    await assert.rejects(native.readArea(caller, 3, rev, async () => 'leaked'), NativeAccessError);
  }
});
test('missing native provider denies account validation and area reads', async () => {
  const native = new NativeAccess(null, 'test');
  assert.equal(await native.accountValid(identity), false);
  await assert.rejects(native.readArea(identity, 3, revision, async () => true), NativeAccessError);
});
