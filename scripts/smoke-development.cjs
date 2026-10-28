const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3000';
async function call(query = '', method = 'GET', cookie = '') {
  return fetch(base + '/api/development' + query, { method, headers: { origin: base, cookie }, signal: AbortSignal.timeout(120000) });
}
(async () => {
  const page = await fetch(base + '/development', { signal: AbortSignal.timeout(120000) });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Choose a disposable account/);
  assert.equal((await call()).status, 401);
  const alice = await call('?account=42', 'POST'); assert.equal(alice.status, 200);
  const a = alice.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await call('', 'GET', a)).json()).areas.length, 2);
  assert.match((await (await call('?area=2&message=3', 'GET', a)).json()).messages[0].body, /synthetic/);
  const bob = await call('?account=73', 'POST', a); assert.equal(bob.status, 200);
  const b = bob.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('', 'GET', a)).status, 401);
  assert.equal((await (await call('', 'GET', b)).json()).areas.length, 1);
  assert.equal((await call('?area=2&message=3', 'GET', b)).status, 404);
  assert.equal((await call('', 'DELETE', b)).status, 200);
  assert.equal((await call('', 'GET', b)).status, 401);
  console.log('Development HTTP flow passed: page, identity isolation, message body, rotation, direct denial, logout.');
})().catch(err => { console.error(err.message); process.exitCode = 1; });
