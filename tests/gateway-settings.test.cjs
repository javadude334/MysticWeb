const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src/lib/auth/' + relative);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : (Object.hasOwn(dependencies, id) ? dependencies[id] : original(id));
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const transport = load('transport.ts');
const { gatewaySettings, configuredGateway } = load('gateway-settings.ts', { './transport': transport });
let directory;
function settings() {
  return {
    MYSTIC_GATEWAY_INSTANCE: 'mystic-sandbox',
    MYSTIC_GATEWAY_URL: 'https://192.168.150.58:8744/v1/native',
    MYSTIC_GATEWAY_CA_FILE: path.join(directory, 'ca.pem'),
    MYSTIC_GATEWAY_CERT_FILE: path.join(directory, 'client.pem'),
    MYSTIC_GATEWAY_KEY_FILE: path.join(directory, 'client.key'),
  };
}
before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mystic-gateway-settings-'));
  const openssl = ['C:/DevApps/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/usr/bin/openssl.exe']
    .find(filename => fs.existsSync(filename)) || 'openssl';
  const run = args => assert.equal(spawnSync(openssl, args, { cwd: directory, stdio: 'ignore' }).status, 0);
  fs.writeFileSync(path.join(directory, 'ca.cnf'), '[req]\ndistinguished_name=dn\nx509_extensions=ca\n[dn]\nCN=Fixture CA\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n');
  fs.writeFileSync(path.join(directory, 'request.cnf'), '[req]\ndistinguished_name=dn\n[dn]\nCN=Ubuntu fixture\n');
  run(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '1',
    '-config', 'ca.cnf', '-subj', '/CN=Fixture CA', '-keyout', 'ca.key', '-out', 'ca.pem']);
  run(['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes',
    '-config', 'request.cnf', '-subj', '/CN=Ubuntu fixture', '-keyout', 'client.key', '-out', 'client.csr']);
  fs.writeFileSync(path.join(directory, 'client.ext'), 'basicConstraints=critical,CA:FALSE\nextendedKeyUsage=clientAuth\n');
  run(['x509', '-req', '-in', 'client.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial',
    '-days', '1', '-extfile', 'client.ext', '-out', 'client.pem']);
});
after(() => {
  if (!directory) return;
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'mystic-gateway-settings-'));
  fs.rmSync(directory, { recursive: true, force: true });
});

test('gateway address is configurable and absent configuration stays disconnected', async () => {
  assert.equal(gatewaySettings({}), null);
  assert.equal(await configuredGateway({}), null);
  const env = settings();
  assert.equal(gatewaySettings(env).url, env.MYSTIC_GATEWAY_URL);
  env.MYSTIC_GATEWAY_URL = 'https://windows-gateway.example:9443/v1/native';
  assert.equal(gatewaySettings(env).url, env.MYSTIC_GATEWAY_URL);
});

test('partial, insecure, credential-bearing and ambiguous endpoint settings deny', () => {
  assert.throws(() => gatewaySettings({ MYSTIC_GATEWAY_URL: settings().MYSTIC_GATEWAY_URL }));
  for (const url of ['http://192.168.150.58:8744/v1/native', 'https://name:secret@host/v1/native',
    'https://host/v1/native?x=1', 'https://host/v1/native#x', 'https://host/other',
    'https://host/../v1/native', 'https://host:443/v1/native']) {
    assert.throws(() => gatewaySettings({ ...settings(), MYSTIC_GATEWAY_URL: url }));
  }
  assert.throws(() => gatewaySettings({ ...settings(), MYSTIC_GATEWAY_KEY_FILE: 'relative.key' }));
});

test('loader validates the certificate identity and creates an unconnected mTLS provider', async () => {
  const result = await configuredGateway(settings());
  assert.equal(result.instance, 'mystic-sandbox');
  assert.ok(result.provider instanceof transport.BridgeTransport);
});

test('mismatched keys, CA-as-client and invalid certificate files return only a fixed error', async () => {
  fs.writeFileSync(path.join(directory, 'invalid.pem'), 'not a certificate');
  for (const changes of [
    { MYSTIC_GATEWAY_KEY_FILE: path.join(directory, 'ca.key') },
    { MYSTIC_GATEWAY_CERT_FILE: path.join(directory, 'ca.pem'), MYSTIC_GATEWAY_KEY_FILE: path.join(directory, 'ca.key') },
    { MYSTIC_GATEWAY_CA_FILE: path.join(directory, 'invalid.pem') },
    { MYSTIC_GATEWAY_KEY_FILE: path.join(directory, 'missing-secret-file') },
  ]) {
    await assert.rejects(configuredGateway({ ...settings(), ...changes }), error => error.message === 'Gateway configuration unavailable');
  }
});

test('overly readable private keys are refused on POSIX', { skip: process.platform === 'win32' }, async () => {
  const key = path.join(directory, 'client.key');
  fs.chmodSync(key, 0o644);
  try { await assert.rejects(configuredGateway(settings())); }
  finally { fs.chmodSync(key, 0o600); }
});
