// Development-only private gateway. No native provider is installed by this entrypoint.
// Configuration contains certificate file paths, never BBS passwords.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const allowed = new Set(['gateway-server', 'gateway-settings', 'transport', 'native']);
  if (!allowed.has(name)) throw new Error('Gateway unavailable');
  const filename = path.join(ROOT, 'src/lib/auth', name + '.ts');
  const mod = new Module(filename, module); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : (id.startsWith('./') && allowed.has(id.slice(2)) ? load(id.slice(2)) : original(id));
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  cache.set(name, mod.exports); return mod.exports;
}
function configuration() {
  if (process.argv.length !== 2 || process.platform !== 'win32' || ROOT.toLowerCase() !== 'e:\\work\\javadude_dev\\mysticweb') throw new Error();
  const filename = path.join(ROOT, '.gateway/windows.env');
  for (let current = filename; ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error();
    if (current === path.dirname(current)) break;
  }
  if (fs.statSync(filename).size > 8192) throw new Error();
  const env = Object.create(null);
  const allowed = new Set(['MYSTIC_GATEWAY_INSTANCE', 'MYSTIC_GATEWAY_BIND_ADDRESS', 'MYSTIC_GATEWAY_PORT',
    'MYSTIC_GATEWAY_ALLOWED_CLIENT', 'MYSTIC_GATEWAY_CA_FILE', 'MYSTIC_GATEWAY_CERT_FILE', 'MYSTIC_GATEWAY_KEY_FILE']);
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([A-Z_]+)=(.+)$/.exec(line);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(env, match[1]) || /[\x00-\x1f\x7f]/.test(match[2])) throw new Error();
    env[match[1]] = match[2];
  }
  if (Object.keys(env).length !== allowed.size || env.MYSTIC_GATEWAY_INSTANCE !== 'mystic-sandbox' ||
    env.MYSTIC_GATEWAY_BIND_ADDRESS !== '192.168.150.58' || env.MYSTIC_GATEWAY_ALLOWED_CLIENT !== '192.168.150.66' ||
    env.MYSTIC_GATEWAY_PORT !== '8744') throw new Error();
  return env;
}
async function main() {
  const env = configuration();
  const tls = await load('gateway-settings').gatewayIdentity({
    caFile: env.MYSTIC_GATEWAY_CA_FILE, certFile: env.MYSTIC_GATEWAY_CERT_FILE, keyFile: env.MYSTIC_GATEWAY_KEY_FILE,
  });
  const server = load('gateway-server').createGatewayServer({
    instance: env.MYSTIC_GATEWAY_INSTANCE, allowedClient: env.MYSTIC_GATEWAY_ALLOWED_CLIENT, tls, provider: null,
  });
  server.on('error', () => { console.error('SANDBOX_GATEWAY: UNAVAILABLE'); process.exitCode = 1; });
  server.listen(Number(env.MYSTIC_GATEWAY_PORT), env.MYSTIC_GATEWAY_BIND_ADDRESS, () => {
    console.log('SANDBOX_GATEWAY: LISTENING; NATIVE_ACCESS_UNVERIFIED');
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    server.close(); server.closeAllConnections(); tls.key.fill(0);
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
main().catch(() => { console.error('SANDBOX_GATEWAY: CONFIGURATION_UNAVAILABLE'); process.exitCode = 1; });
