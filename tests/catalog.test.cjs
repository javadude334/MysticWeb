const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, '../src/lib', name + '.ts');
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : id.startsWith('.') ?
    load(path.relative(path.resolve(__dirname, '../src/lib'), path.resolve(path.dirname(filename), id)).replaceAll('\\', '/')) : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const { parseReadOnlyCatalog, readReadOnlyCatalog } = load('mystic/catalog');
function put(r, p, s) { const b = Buffer.from(s); r[p] = b.length; b.copy(r, p + 1); }
function group() { const b = Buffer.alloc(206); b.writeUInt32LE(2); put(b, 4, 'G'.repeat(80)); return b; }
function base(id, kind = 1, flags = 0) {
  const b = Buffer.alloc(768); b.writeUInt16LE(id); b[260] = kind; b.writeUInt32LE(flags, 577);
  put(b, 2, 'Radio'); put(b, 138, 'radio' + id); put(b, 179, 'msgs'); return b;
}
test('catalog excludes local/private/netmail without treating metadata as permissions', () => {
  const root = path.resolve('fixture');
  const rows = Buffer.concat([base(1, 0), base(2), base(3, 3), base(4, 1, 16)]);
  const c = parseReadOnlyCatalog(group(), rows, root, path.join(root, 'msgs'));
  assert.deepEqual(c.areas, [{ id: 2, name: 'Radio', jamBase: 'radio2' }]);
  if (process.platform === 'win32') assert.deepEqual(parseReadOnlyCatalog(group(), rows, root.toUpperCase(), path.join(root, 'msgs').toLowerCase()).areas, c.areas);
  const changed = Buffer.from(rows); put(changed, 768 + 263, 'u1g2');
  assert.notEqual(c.revision, parseReadOnlyCatalog(group(), changed, root, path.join(root, 'msgs')).revision);
});
test('catalog rejects ambiguous IDs, malformed layout and paths outside message root', () => {
  const root = path.resolve('fixture'), msgs = path.join(root, 'msgs');
  assert.throws(() => parseReadOnlyCatalog(group(), Buffer.concat([base(2), base(2)]), root, msgs));
  assert.throws(() => parseReadOnlyCatalog(group().subarray(1), base(2), root, msgs));
  const alias = base(3, 1, 16); put(alias, 138, 'radio2');
  assert.throws(() => parseReadOnlyCatalog(group(), Buffer.concat([base(2), alias]), root, msgs), /Aliased/);
  const b = base(2); put(b, 179, '../outside');
  assert.throws(() => parseReadOnlyCatalog(group(), b, root, msgs));
  put(b, 179, 'msgs'); put(b, 138, '../radio');
  assert.throws(() => parseReadOnlyCatalog(group(), b, root, msgs));
});
test('catalog loads only configuration and rejects a linked catalog file', async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'mystic-catalog-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.mkdir(path.join(root, 'data')); await fsp.mkdir(path.join(root, 'msgs'));
  await fsp.writeFile(path.join(root, 'data/groups_g.dat'), group());
  await fsp.writeFile(path.join(root, 'data/mbases.dat'), base(2));
  assert.equal((await readReadOnlyCatalog(root, path.join(root, 'msgs'))).areas.length, 1);
  await assert.rejects(readReadOnlyCatalog(root, path.dirname(root)));
  if (process.platform === 'win32') return; // Creating links may require elevation; native path guards are still used.
  await fsp.rename(path.join(root, 'data/mbases.dat'), path.join(root, 'data/real.dat'));
  await fsp.symlink('real.dat', path.join(root, 'data/mbases.dat'));
  await assert.rejects(readReadOnlyCatalog(root, path.join(root, 'msgs')));
});
