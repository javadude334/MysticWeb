// Sandbox-only Mystic terminal protocol probe. No browser sessions are created.
'use strict';
const fs = require('node:fs');
const { Client } = require('ssh2');
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { hiddenPassword } = require('./sandbox-nntps-login.cjs');
const PIN = 'd133e0feb8209cb665a525f1cfb0f95505b5aac850b720f5bab2e86d19ac6732';
const PREFIX = 'MYSTICWEB/1 ';
async function main() {
  if (process.platform !== 'linux' || !process.stdin.isTTY || !process.stdout.isTTY || process.argv.length !== 2)
    throw new Error('INPUT');
  const root = fs.realpathSync('/media/sf_sandbox');
  if (root !== '/media/sf_sandbox' || !fs.statSync(root + '/data/users.dat').isFile())
    throw new Error('SANDBOX_PATH');
  const host = process.env.MYSTIC_SSH_HOST;
  const port = Number(process.env.MYSTIC_SSH_PORT);
  if (host !== '192.168.150.58' || port !== 8022) throw new Error('SANDBOX_ENDPOINT');
  const nonce = randomBytes(32).toString('base64url');
  const request = JSON.stringify({ version: 1, nonce, operation: 'authenticate', instance: 'mystic-sandbox' }) + '\r';
  let password = await hiddenPassword();
  const client = new Client();
  let stage = 'CONNECT', done = false, attempt, buffer = '', sent = false;
  try {
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        password = '';
        if (attempt) attempt.password = '';
        client.destroy();
        error ? reject(error) : resolve();
      };
      const timer = setTimeout(() => finish(new Error('TIMEOUT_' + stage)), 25000);
      client.on('error', () => finish(new Error(stage === 'HOST_KEY' ? 'HOST_KEY' : 'SSH_CONNECTION')));
      client.on('close', () => { if (!done) finish(new Error('SSH_CLOSED_' + stage)); });
      client.on('ready', () => {
        password = '';
        if (attempt) attempt.password = '';
        stage = 'SHELL';
        client.shell({ term: 'ansi', cols: 80, rows: 25 }, (error, channel) => {
          if (error) return finish(new Error('SHELL'));
          stage = 'READY';
          channel.on('error', () => finish(new Error('CHANNEL')));
          channel.on('data', chunk => {
            buffer += chunk.toString('latin1');
            if (buffer.length > 32768) return finish(new Error('OUTPUT_LIMIT'));
            if (buffer.includes('\x1b[6n')) {
              channel.write('\x1b[25;80R');
              buffer = buffer.replace(/\x1b\[6n/g, '');
            }
            // Strip terminal escape sequences and carriage returns before scanning lines.
            const clean = buffer.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '\n');
            if (!sent && clean.includes('MYSTICWEB/1 READY')) {
              sent = true;
              stage = 'RESPONSE';
              channel.write(request);
            }
            if (!sent) return;
            for (const line of clean.split('\n')) {
              const at = line.indexOf(PREFIX);
              if (at < 0) continue;
              const payload = line.slice(at + PREFIX.length).trim();
              if (!payload.startsWith('{')) continue;
              let reply;
              try { reply = JSON.parse(payload); } catch { return finish(new Error('RESPONSE_JSON')); }
              if (reply.version !== 1 || reply.nonce !== nonce || reply.operation !== 'authenticate' ||
                  reply.instance !== 'mystic-sandbox' || !Number.isInteger(reply.userId) ||
                  reply.account?.exists !== false)
                return finish(new Error('RESPONSE_INVALID'));
              console.log('NATIVE_WORKER_REQUEST_RESPONSE: PASS; userId=' + reply.userId);
              console.log('BROWSER_LOGIN: NOT_ENABLED');
              return finish();
            }
          });
          channel.write('\r');
        });
      });
      client.connect({
        host, port, username: 'javadude2', readyTimeout: 20000,
        algorithms: { cipher: ['aes256-cbc'] },
        hostVerifier: key => {
          const accepted = timingSafeEqual(createHash('sha256').update(key).digest(), Buffer.from(PIN, 'hex'));
          stage = accepted ? 'SSH_AUTH' : 'HOST_KEY';
          return accepted;
        },
        authHandler: (_methods, _partial, next) => {
          if (!password) return finish(new Error('AUTH_REJECTED'));
          attempt = { type: 'password', username: 'javadude2', password };
          password = '';
          next(attempt);
        }
      });
    });
  } finally { password = ''; buffer = ''; client.destroy(); }
}
if (require.main === module) main().catch(error => {
  const code = /^(INPUT|SANDBOX_PATH|SANDBOX_ENDPOINT|HOST_KEY|SSH_CONNECTION|SHELL|CHANNEL|OUTPUT_LIMIT|AUTH_REJECTED|RESPONSE_JSON|RESPONSE_INVALID|TIMEOUT_[A-Z_]+|SSH_CLOSED_[A-Z_]+)$/.test(error.message) ? error.message : 'RUNTIME';
  console.error('NATIVE_WORKER_PROTOCOL: UNAVAILABLE; stage=' + code);
  process.exitCode = 1;
});
