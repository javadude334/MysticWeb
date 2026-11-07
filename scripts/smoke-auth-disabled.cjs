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
    cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, MYSTICWEB_DEMO: '1' },
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
    const deniedEndpoints = [
      ['/api/auth/login', 'POST', 503, { error: 'Sandbox sign-in unavailable' }],
      ['/api/auth/logout', 'POST', 503, { error: 'Sandbox logout unavailable' }],
      ['/api/auth/session', 'GET', 401, { authenticated: false }],
    ];
    for (const [url, method, expectedStatus, expectedBody] of deniedEndpoints) {
      const result = await fetch(base + url, { method, signal: AbortSignal.timeout(5000),
        ...(method === 'POST' ? { body: '{', headers: { 'content-type': 'application/json' } } : {}) });
      assert.equal(result.status, expectedStatus, `${method} ${url}: status`);
      assert.equal(result.headers.get('cache-control'), 'private, no-store', `${method} ${url}: cache-control`);
      assert.equal(result.headers.get('set-cookie'), null, `${method} ${url}: set-cookie`);
      assert.deepEqual(await result.json(), expectedBody, `${method} ${url}: response body`);
    }
    const messages = await fetch(base + '/api/messages?area=1', { signal: AbortSignal.timeout(5000) });
    assert.equal(messages.headers.get('set-cookie'), null, 'messages: set-cookie');
    assert.notEqual(messages.status, 200, 'messages must not be accessible without a native runtime');
    // Protected page redirects to login; fetch must not silently follow it.
    const developmentPage = await fetch(base + '/development', {
      redirect: 'manual', signal: AbortSignal.timeout(5000),
    });
    assert.ok([307, 308].includes(developmentPage.status), 'development page must redirect');
    assert.match(developmentPage.headers.get('location') ?? '', /\/login\?next=%2Fdevelopment/);
    assert.equal(developmentPage.headers.get('set-cookie'), null);
    const developmentApi = await fetch(base + '/api/development', { signal: AbortSignal.timeout(5000) });
    assert.equal(developmentApi.status, 404, 'development API must remain disabled');
    assert.equal(developmentApi.headers.get('set-cookie'), null);
    const login = await fetch(base + '/login', { signal: AbortSignal.timeout(5000) });
    assert.equal(login.status, 200);
    const loginHtml = await login.text();
    assert.match(loginHtml, /<form\b/i);
    assert.match(loginHtml, /BBS handle/);
    assert.match(loginHtml, /type="password"/);
    assert.match(loginHtml, /Sign in with your Mystic BBS handle and password/);
    console.log('Built app: credential form renders; authentication and message endpoints fail closed without configured native runtime.');
  } finally {
    child.kill();
    if (child.pid && child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  }
}
main().catch((error) => { console.error('Disabled-auth smoke check failed:', error); process.exitCode = 1; });
