// Run after a production build. No native host, credentials or BBS files needed.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

async function main() {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const root = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: root, windowsHide: true, stdio: 'ignore',
  });
  let failed = false;
  child.on('error', () => { failed = true; });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failed || child.exitCode !== null) throw new Error('Built server unavailable');
      try { ready = (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).status === 200; } catch { /* starting */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.equal(ready, true);
    for (const [url, method] of [['/api/auth/login', 'POST'], ['/api/auth/logout', 'POST'], ['/api/messages?area=1', 'GET']]) {
      const result = await fetch(base + url, { method, signal: AbortSignal.timeout(5000),
        ...(method === 'POST' ? { body: '{', headers: { 'content-type': 'application/json' } } : {}) });
      assert.equal(result.status, 503);
      assert.equal(result.headers.get('cache-control'), 'private, no-store');
      assert.equal(result.headers.get('set-cookie'), null);
      assert.deepEqual(await result.json(), { error: 'Access unavailable' });
    }
    const login = await fetch(base + '/login', { signal: AbortSignal.timeout(5000) });
    assert.equal(login.status, 200);
    assert.doesNotMatch(await login.text(), /<input\b/i);
    console.log('Built app: authentication and message endpoints fail closed; no credential form.');
  } finally {
    child.kill();
    if (child.pid && child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  }
}
main().catch(() => { console.error('Disabled-auth smoke check failed'); process.exitCode = 1; });
