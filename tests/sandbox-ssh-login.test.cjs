const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeNativeOutput } = require('../scripts/sandbox-ssh-login.cjs');
const report = JSON.stringify({ probe: 'CURRENT_SESSION_CONTEXT', nativeSessionUserId: 2,
  browserEnabled: false, eligibilityCertified: false, productionIdentityAdapter: false, groups: [], areas: [] });

test('correct login requires identity proof, not SSH acceptance or a login prompt', () => {
  assert.deepEqual(analyzeNativeOutput('Enter your user name:', true), { stage: 'NATIVE_LOGIN_PROMPT' });
  assert.deepEqual(analyzeNativeOutput(report + '\r\n', true), { proof: { userId: 2 } });
  assert.deepEqual(analyzeNativeOutput(report.replace('"nativeSessionUserId":2', '"nativeSessionUserId":1'), true), { error: 'IDENTITY_PROOF' });
});
test('negative control reports an observed unauthenticated prompt without inventing a password code', () => {
  assert.deepEqual(analyzeNativeOutput('\x1b[37m[] Enter your user name: ', false),
    { proof: { noSession: true, native: 'LOGIN_PROMPT' } });
  assert.deepEqual(analyzeNativeOutput('SSH connected', false), { stage: 'NATIVE_STARTUP' });
  assert.deepEqual(analyzeNativeOutput('Enter your password:', false), { stage: 'NATIVE_PASSWORD_PROMPT' });
});
test('authenticated output and native probe failures override negative-control prompt text', () => {
  assert.deepEqual(analyzeNativeOutput('Enter your user name:\r\n' + report + '\r\n', false), { error: 'WRONG_PASSWORD_ACCEPTED' });
  assert.deepEqual(analyzeNativeOutput('Enter your user name:\r\nCURRENT_SESSION_CONTEXT: UNAVAILABLE', false), { error: 'NATIVE_PROBE' });
});
