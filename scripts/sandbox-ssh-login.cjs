// Interactive native SSH login proof. No passwords in args, files or logs.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { Client } = require('ssh2');
const { hiddenPassword } = require('./sandbox-nntps-login.cjs');
const PIN = 'd133e0feb8209cb665a525f1cfb0f95505b5aac850b720f5bab2e86d19ac6732';

function connect(password, expectedProof) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let candidate = password, attempt, raw = '', finished = false, stage = 'CONNECT';
    password = '';
    const end = (error, value) => {
      if (finished) return;
      finished = true; clearTimeout(timer); candidate = ''; raw = '';
      if (attempt) attempt.password = '';
      client.destroy();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => end(new Error('TIMEOUT_' + stage)), 25000);
    client.on('error', error => end(new Error(stage === 'HOST_KEY' ? 'HOST_KEY' : (error.level === 'client-authentication' ? 'CREDENTIALS_REJECTED' : 'TRANSPORT'))));
    client.on('close', () => { if (!finished) end(new Error('CONNECTION_CLOSED')); });
    client.on('ready', () => {
      stage = 'SSH_SHELL';
      candidate = ''; if (attempt) attempt.password = '';
      client.shell({ term: 'ansi', cols: 80, rows: 25 }, (error, stream) => {
        if (error) { end(new Error('SHELL')); return; }
        stage = 'NATIVE_STARTUP';
        stream.on('error', () => end(new Error('SHELL')));
        stream.on('data', chunk => {
          raw += chunk.toString('latin1');
          if (raw.length > 32768) { end(new Error('OUTPUT_LIMIT')); return; }
          // Answer only terminal-position detection, never BBS prompts or menus.
          if (raw.includes('\x1b[6n')) { stream.write('\x1b[25;80R'); raw = raw.replace(/\x1b\[6n/g, ''); }
          const clean = raw.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
          if (clean.includes('Enter your user name:')) stage = 'NATIVE_LOGIN_PROMPT';
          if (clean.includes('Enter your password:')) stage = 'NATIVE_PASSWORD_PROMPT';
          if (clean.includes('IDENTITY_SHAPE:')) stage = 'NATIVE_PROBE';
          for (const line of clean.split(/\r?\n/)) {
            if (!line.startsWith('{')) continue;
            let report; try { report = JSON.parse(line); } catch { continue; }
            if (report.probe !== 'CURRENT_SESSION_CONTEXT' || report.nativeSessionUserId !== 2 ||
                report.browserEnabled !== false || report.eligibilityCertified !== false ||
                report.productionIdentityAdapter !== false || !Array.isArray(report.groups) || !Array.isArray(report.areas)) {
              end(new Error('IDENTITY_PROOF')); return;
            }
            if (!expectedProof) { end(new Error('WRONG_PASSWORD_ACCEPTED')); return; }
            end(null, { userId: 2 }); return;
          }
          if (clean.includes('CURRENT_SESSION_CONTEXT: UNAVAILABLE')) end(new Error('NATIVE_PROBE'));
        });
        // Wake Mystic's terminal detection; do not answer native account/menu prompts.
        stream.write('\r');
      });
    });
    client.connect({ host: '127.0.0.1', port: 8022, username: 'javadude2',
      readyTimeout: 20000, algorithms: { cipher: ['aes256-cbc'] },
      hostVerifier: key => {
        const accepted = timingSafeEqual(createHash('sha256').update(key).digest(), Buffer.from(PIN, 'hex'));
        stage = accepted ? 'SSH_AUTH' : 'HOST_KEY';
        return accepted;
      },
      authHandler: (_methods, _partial, next) => {
        if (!candidate) { end(new Error('CREDENTIALS_REJECTED')); return; }
        attempt = { type: 'password', username: 'javadude2', password: candidate };
        candidate = ''; next(attempt);
      },
    });
  });
}

async function main() {
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY || process.platform !== 'win32' ||
      path.resolve(__dirname, '..').toLowerCase() !== 'e:\\work\\javadude_dev\\mysticweb') throw new Error('INPUT');
  for (const part of ['E:/mystic', 'E:/mystic/themes', 'E:/mystic/themes/default', 'E:/mystic/themes/default/scripts',
    'E:/mystic/themes/default/scripts/after_login.mpx']) {
    if (fs.lstatSync(part).isSymbolicLink()) throw new Error('SANDBOX_PATH');
  }
  console.log('Sandbox automated SSH login check for javadude2. No Telnet session needed.');
  console.log('The password stays in memory; only result lines are printed.');
  console.log('Native login can update normal BBS call statistics; no message/read-pointer command is sent.');
  let candidate = await hiddenPassword();
  let wrong = randomBytes(12).toString('hex');
  if (wrong === candidate) wrong = 'x';
  try {
    const proof = await connect(candidate, true);
    console.log('NATIVE_SSH_ACCOUNT_AND_ID: PASS; userId=' + proof.userId);
  } finally { candidate = ''; }
  // Give the native session time to release the sandbox's one-per-IP slot.
  await new Promise(resolve => setTimeout(resolve, 1000));
  try {
    await connect(wrong, false);
    throw new Error('WRONG_PASSWORD_ACCEPTED');
  } catch (error) {
    if (error.message !== 'CREDENTIALS_REJECTED') throw error;
    console.log('NATIVE_SSH_WRONG_PASSWORD_REJECTED: PASS');
  } finally { wrong = ''; }
  console.log('BROWSER_LOGIN: NOT_ENABLED; account revocation and full web bridge remain separate.');
}

if (require.main === module) main().catch(error => {
  const stages = ['INPUT', 'SANDBOX_PATH', 'HOST_KEY', 'CREDENTIALS_REJECTED', 'TRANSPORT', 'CONNECTION_CLOSED',
    'WRONG_PASSWORD_ACCEPTED', 'SHELL', 'OUTPUT_LIMIT', 'IDENTITY_PROOF', 'NATIVE_PROBE'];
  const timeout = /^TIMEOUT_(CONNECT|HOST_KEY|SSH_AUTH|SSH_SHELL|NATIVE_STARTUP|NATIVE_LOGIN_PROMPT|NATIVE_PASSWORD_PROMPT|NATIVE_PROBE)$/.test(error.message);
  console.error('NATIVE_SSH_LOGIN: UNAVAILABLE; stage=' + (timeout || stages.includes(error.message) ? error.message : 'INPUT_OR_RUNTIME'));
  process.exitCode = 1;
});
