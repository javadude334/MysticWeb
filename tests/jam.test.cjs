const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const sync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(overrides = {}) {
  const filename = path.resolve(__dirname, '../src/lib/mystic/jam.ts');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : overrides[id] ?? original(id);
  mod._compile(ts.transpileModule(sync.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const { readJam, decodeJamText } = load();

function subfield(id, bytes) {
  bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const prefix = Buffer.alloc(8);
  prefix.writeUInt16LE(id);
  prefix.writeUInt32LE(bytes.length, 4);
  return Buffer.concat([prefix, bytes]);
}

// Synthetic multi-file binary fixtures, not copies of private BBS content.
async function fixture(t, records, first = 500) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mystic-jam-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const info = Buffer.alloc(1024);
  info.write('JAM\0');
  info.writeUInt32LE(0xffffffff, 16);
  info.writeUInt32LE(first, 20);
  const headers = [info], bodies = [], indexes = [];
  let offset = 1024, textOffset = 0;
  records.forEach((record, i) => {
    const index = Buffer.alloc(8, 0xff);
    if (record !== null) {
      const fields = record.fields ?? Buffer.concat([
        subfield(2, 'Alice'), subfield(3, 'All'), subfield(6, record.subject ?? 'Test'),
        subfield(4, `1:2/3 ${i}`), ...(record.encoding ? [subfield(2000, `CHRS: ${record.encoding} 4`)] : []),
      ]);
      const body = Buffer.isBuffer(record.body) ? record.body : Buffer.from(record.body ?? 'Hello\rworld\r');
      const header = Buffer.alloc(76);
      header.write('JAM\0'); header.writeUInt16LE(1, 4);
      header.writeUInt32LE(fields.length, 8);
      header.writeUInt32LE(record.replyTo ?? 0, 24);
      header.writeUInt32LE(1700000000, 36);
      header.writeUInt32LE(record.number ?? first + i, 48);
      header.writeUInt32LE(record.attributes ?? 0x01000000, 52);
      header.writeUInt32LE(textOffset, 60); header.writeUInt32LE(body.length, 64);
      header.writeUInt32LE(record.password ?? 0xffffffff, 68);
      record.mutate?.(header);
      index.writeUInt32LE(record.offset ?? offset, 4);
      headers.push(header, fields); bodies.push(body);
      offset += 76 + fields.length; textOffset += body.length;
    }
    indexes.push(index);
  });
  await Promise.all(['jhr', 'jdx', 'jdt', 'jlr'].map((ext, i) => fs.writeFile(path.join(root, `area.${ext}`),
    [Buffer.concat(headers), Buffer.concat(indexes), Buffer.concat(bodies), Buffer.from('lastread sentinel')][i])));
  return root;
}

test('reads headers, dates, bodies and true reply links; keeps original files unchanged', async t => {
  const root = await fixture(t, [{ subject: 'Root' }, { subject: 'Reply', replyTo: 500 }]);
  const before = await Promise.all(['jhr','jdx','jdt','jlr'].map(ext => fs.readFile(path.join(root, `area.${ext}`))));
  const page = await readJam(root, 'area', { limit: 1 });
  assert.equal(page.messages[0].number, 501);
  assert.equal(page.messages[0].replyTo, 500);
  assert.equal(page.messages[0].dates.written, 1700000000);
  assert.equal(page.messages[0].author, 'Alice');
  assert.equal(page.messages[0].recipient, 'All');
  assert.equal(page.messages[0].body, undefined);
  assert.equal(page.nextBefore, 501);
  assert.equal((await readJam(root, 'area', { before: page.nextBefore })).messages[0].subject, 'Root');
  assert.equal((await readJam(root, 'area', { message: 501 })).messages[0].body, 'Hello\nworld\n');
  const after = await Promise.all(['jhr','jdx','jdt','jlr'].map(ext => fs.readFile(path.join(root, `area.${ext}`))));
  assert.deepEqual(after, before);
});

test('hides deleted, private, netmail, nodisp, encrypted and password-protected messages', async t => {
  const flags = [0x80000000,4,0x02000000,0x20000000,0x80000,0x100000,0x200000];
  const root = await fixture(t, [null, ...flags.map(attributes => ({ attributes })), { password: 0 }, {}]);
  const page = await readJam(root, 'area');
  assert.deepEqual(page.messages.map(m => m.number), [509]);
  for (let number = 500; number < 509; number++) assert.equal((await readJam(root, 'area', { message: number })).messages.length, 0);
});

test('skips malformed records and bounds every offset, length and subfield', async t => {
  const bad = [
    { offset: 10 }, { offset: 0xffffff00 }, { number: 1 },
    { mutate: h => h.writeUInt16LE(2, 4) },
    { mutate: h => h.writeUInt32LE(0xffffff00, 8) },
    { mutate: h => h.writeUInt32LE(0xffffff00, 60) },
    { mutate: h => h.writeUInt32LE(0xffffff00, 64) },
    { fields: Buffer.alloc(7) },
    { fields: Buffer.concat([subfield(2, 'one'), subfield(2, 'two')]) },
  ];
  const root = await fixture(t, [...bad, {}]);
  const page = await readJam(root, 'area');
  assert.equal(page.messages.length, 1); assert.equal(page.skipped, bad.length);
});

test('supports CP437 and declared UTF-8, normalizes line endings and strips controls', async t => {
  assert.equal(decodeJamText(Buffer.from([0x82,0xb3,0xdb])), 'é│█');
  assert.equal(decodeJamText(Buffer.from('a\x00\x1bb\r\nc\r')), 'ab\nc\n');
  const root = await fixture(t, [{ encoding: 'UTF-8', subject: 'Café', body: '世界' }, { encoding: 'UNKNOWN' }]);
  assert.equal((await readJam(root, 'area', { message: 500 })).messages[0].body, '世界');
  assert.equal((await readJam(root, 'area')).messages.length, 1);
  assert.throws(() => decodeJamText(Buffer.from([0xff]), 'UTF-8'));
});

test('rejects path traversal, invalid pagination, truncated indexes and protected bases', async t => {
  const root = await fixture(t, [{}]);
  for (const base of ['../area', '/area', 'a/b', 'a\\b', 'C:area', 'a..b', '']) await assert.rejects(readJam(root, base), { code: 'INVALID' });
  for (const options of [{ limit: 0 }, { limit: 51 }, { before: -1 }, { message: 0 }, { limit: 1.5 }]) await assert.rejects(readJam(root, 'area', options), { code: 'INVALID' });
  const handle = await fs.open(path.join(root, 'area.jhr'), 'r+');
  await handle.write(Buffer.alloc(4), 0, 4, 16); await handle.close();
  await assert.rejects(readJam(root, 'area'), { code: 'INVALID' });
  await fs.appendFile(path.join(root, 'area.jdx'), Buffer.alloc(1));
  await assert.rejects(readJam(root, 'area'), { code: 'INVALID' });
  await assert.rejects(readJam(root, 'missing'), error => error.code === 'UNAVAILABLE' && !error.message.includes(root));
});

test('limits sparse database scans and provides continuation without scanning the whole base', async t => {
  const root = await fixture(t, [{}, ...Array(1005).fill(null)]);
  const page = await readJam(root, 'area');
  assert.equal(page.scanned, 1000); assert.equal(page.messages.length, 0);
  assert.equal((await readJam(root, 'area', { before: page.nextBefore })).messages[0].number, 500);
});

test('detects concurrent mutation and closes all read-only handles', async t => {
  const root = await fixture(t, [{}]);
  let count = 0, closed = 0;
  const reader = load({ 'node:fs/promises': { ...fs, open: async (filename, mode) => {
    assert.equal(mode, 'r'); const h = await fs.open(filename, mode);
    return { read: h.read.bind(h), stat: async options => {
      const result = await h.stat(options);
      if (++count > 3) result.mtimeNs += BigInt(1);
      return result;
    }, close: async () => { closed++; await h.close(); } };
  } } });
  await assert.rejects(reader.readJam(root, 'area'), { code: 'CHANGED' });
  assert.equal(closed, 3);
});

test('empty databases and missing direct message numbers return no messages', async t => {
  const root = await fixture(t, []);
  assert.deepEqual((await readJam(root, 'area')).messages, []);
  assert.deepEqual((await readJam(root, 'area', { message: 999 })).messages, []);
});

test('supports punctuation present in configured BBS base names without shell interpretation', async t => {
  const root = await fixture(t, [{}]);
  const base = "net.news&what's_hot!";
  for (const ext of ['jhr', 'jdx', 'jdt']) await fs.rename(path.join(root, `area.${ext}`), path.join(root, `${base}.${ext}`));
  assert.equal((await readJam(root, base)).messages.length, 1);
});

test('rejects symbolic links escaping the configured JAM root', async t => {
  const root = await fixture(t, [{}]);
  const outside = await fixture(t, [{}]);
  await fs.unlink(path.join(root, 'area.jhr'));
  try { await fs.symlink(path.join(outside, 'area.jhr'), path.join(root, 'area.jhr')); }
  catch (error) {
    if (error.code === 'EPERM') { t.skip('Host requires elevation to create symlinks'); return; }
    throw error;
  }
  await assert.rejects(readJam(root, 'area'), { code: 'INVALID' });
});

test('handles short reads and closes earlier handles if a later file is missing', async t => {
  const root = await fixture(t, [{}]);
  let closed = 0;
  const reader = load({ 'node:fs/promises': { ...fs, open: async (filename, mode) => {
    const h = await fs.open(filename, mode);
    return { stat: h.stat.bind(h), read: (buffer, offset, length, position) => h.read(buffer, offset, Math.min(3, length), position),
      close: async () => { closed++; await h.close(); } };
  } } });
  assert.equal((await reader.readJam(root, 'area', { message: 500 })).messages[0].body, 'Hello\nworld\n');
  assert.equal(closed, 3);
  await fs.unlink(path.join(root, 'area.jdt'));
  await assert.rejects(reader.readJam(root, 'area'), { code: 'UNAVAILABLE' });
  assert.equal(closed, 5);
});

test('reads declared ASCII and CP850 headers and bodies without losing legacy messages', async t => {
  assert.equal(decodeJamText(Buffer.from([0x9b, 0x9d, 0xb5, 0xd5]), 'CP850'), 'øØÁı');
  assert.equal(decodeJamText(Buffer.from('Plain\r\ntext'), 'US-ASCII'), 'Plain\ntext');
  assert.throws(() => decodeJamText(Buffer.from([0x80]), 'ASCII'), { code: 'ENCODING' });
  const root = await fixture(t, [
    { encoding: 'ASCII', subject: 'Radio notes', body: 'Read only' },
    { encoding: 'CP850', subject: Buffer.from([0x9b, 0xb5]), body: Buffer.from([0x9d, 0xd5]) },
  ]);
  const page = await readJam(root, 'area');
  assert.equal(page.messages.length, 2);
  assert.equal(page.skipped, 0);
  assert.equal(page.messages[0].subject, 'øÁ');
  assert.equal((await readJam(root, 'area', { message: 501 })).messages[0].body, 'Øı');
});
