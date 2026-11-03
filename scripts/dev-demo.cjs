// Bind only loopback. Never start this fixture workspace on a public interface.
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', 'localhost', '--port', '3000'], {
  stdio: 'inherit', env: { ...process.env, MYSTICWEB_DEMO: '1' },
});
child.on('exit', code => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
