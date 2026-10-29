// Operator-only E: verification. No browser sessions and no ARTICLE/OVER requests.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { spawn, spawnSync } = require('node:child_process');
const { createInterface } = require('node:readline/promises');
const ts = require('typescript');
const { hiddenPassword } = require('./sandbox-nntps-login.cjs');
const ROOT = 'E:\\mystic';
const accounts = [{ id: 1, handle: 'test' }, { id: 2, handle: 'javadude2' }];
const sessions = [];
let locker, heartbeat, pendingHeartbeat = Promise.resolve(), heartbeatFailed = false, operatorRun = false, topology, lockedCatalogHash;
const results = [];

function checked(candidate) {
  const absolute = path.win32.resolve(candidate), relative = path.win32.relative(ROOT, absolute);
  if (relative === '..' || relative.startsWith('..\\') || path.win32.isAbsolute(relative)) throw new Error('Sandbox boundary');
  let current = ROOT;
  if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Linked root');
  for (const part of relative.split('\\').filter(Boolean)) {
    current = path.win32.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Linked component');
  }
  return absolute;
}
function snapshot() {
  const bytes = fs.readFileSync(checked(path.win32.join(ROOT, 'data', 'mbases.dat')));
  if (bytes.length % 768 || bytes.length > 512 * 768) throw new Error('Catalog layout');
  const areas = new Map(), privateNames = [], ids = new Set(), names = new Set();
  const topologyBytes = Buffer.from(bytes);
  for (let offset = 0; offset < bytes.length; offset += 768) {
    const r = bytes.subarray(offset, offset + 768), id = r.readUInt16LE(0);
    if (!id || ids.has(id)) throw new Error('Ambiguous area identity'); ids.add(id);
    const field = (o, n) => { if (r[o] > n) throw new Error('Catalog field'); return r.subarray(o + 1, o + 1 + r[o]).toString('latin1'); };
    const nativeName = field(77, 60);
    if (nativeName) {
      const key = nativeName.toLowerCase();
      if (names.has(key)) throw new Error('Ambiguous newsgroup identity'); names.add(key);
    }
    if ((r.readUInt32LE(577) & 16) || r[260] === 3) { if (nativeName) privateNames.push(nativeName); }
    if (![2, 5].includes(id)) continue;
    if ((r.readUInt32LE(577) & 16) || r[260] === 3) throw new Error('Private fixture');
    const group = field(77, 60);
    if (!/^[A-Za-z0-9][A-Za-z0-9+_.-]{0,59}$/.test(group)) throw new Error('Fixture newsgroup');
    areas.set(id, { id, group, list: field(263, 30), read: field(294, 30) });
    topologyBytes.fill(0, offset + 263, offset + 325);
  }
  if (areas.size !== 2) throw new Error('Fixture missing');
  const groups = fs.readFileSync(checked(path.win32.join(ROOT, 'data', 'groups_g.dat')));
  if (groups.length % 206 || groups.length > 512 * 206) throw new Error('Group layout');
  let groupRule; const groupIds = new Set(), groupTopology = Buffer.from(groups);
  for (let o = 0; o < groups.length; o += 206) {
    const id = groups.readUInt32LE(o); if (!id || groupIds.has(id)) throw new Error('Ambiguous group identity'); groupIds.add(id);
    if (id !== 2) continue;
    const length = groups[o + 167]; if (length > 30) throw new Error('Group field');
    groupRule = groups.subarray(o + 168, o + 168 + length).toString('latin1');
    groupTopology.fill(0, o + 167, o + 198);
  }
  if (groupRule === undefined) throw new Error('TestNET group missing');
  const hash = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
  return { areas, privateNames, groupRule, catalogHash: hash(bytes), topology: hash(Buffer.concat([topologyBytes, groupTopology])),
    revision: require('node:crypto').createHash('sha256').update(bytes).update(groups).digest('hex') };
}
function accountFlags(id) {
  const fd = fs.openSync(checked(path.win32.join(ROOT, 'data', 'users.dat')), 'r');
  try {
    const stat = fs.fstatSync(fd); if (stat.size % 1536 || stat.size > 16 * 1024 * 1024) throw new Error('User layout');
    let value, matches = 0;
    for (let o = 0; o < stat.size; o += 1536) {
      const prefix = Buffer.alloc(8);
      if (fs.readSync(fd, prefix, 0, 8, o) !== 8) throw new Error('User prefix');
      if (prefix.readUInt32LE(0) !== id) continue;
      const handle = Buffer.alloc(31);
      if (fs.readSync(fd, handle, 0, 31, o + 109) !== 31 || handle[0] > 30) throw new Error('User handle');
      if (handle.subarray(1, 1 + handle[0]).toString('latin1') !== accounts.find(a => a.id === id).handle) throw new Error('Fixture identity changed');
      matches++; value = prefix.readUInt32LE(4);
    }
    const after = fs.fstatSync(fd);
    if (matches !== 1 || stat.size !== after.size || stat.mtimeMs !== after.mtimeMs) throw new Error('User snapshot changed');
    return value;
  } finally { fs.closeSync(fd); }
}
function normalized(rule) { return rule.toLowerCase().replace(/\s/g, ''); }
function matches(plan, config) {
  return normalized(config.groupRule) === plan.group && plan.areas.every(([id, list, read]) => {
    const area = config.areas.get(id); return normalized(area.list) === list && normalized(area.read) === read;
  }) && (plan.locked === undefined || !!(accountFlags(1) & 1) === plan.locked);
}
async function ask(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(prompt); } finally { rl.close(); }
}
function emit(result) { results.push(result); console.log(JSON.stringify(result)); }
async function acquireLocks() {
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(__dirname, 'sandbox-message-read-locks.ps1')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  locker = child;
  await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => { child.kill(); reject(new Error('Lock timeout')); }, 8000);
    child.stdout.on('data', chunk => {
      output += chunk.toString('ascii');
      const ready = /MESSAGE_LOCKS_READY [0-9]+ ([a-f0-9]{64})/.exec(output);
      if (ready) { lockedCatalogHash = ready[1]; clearTimeout(timer); resolve(); }
      else if (output.includes('MESSAGE_LOCKS_UNAVAILABLE')) { clearTimeout(timer); reject(new Error('Write prevention unavailable')); }
    });
    child.on('error', () => { clearTimeout(timer); reject(new Error('Lock process unavailable')); });
    child.on('exit', () => { clearTimeout(timer); reject(new Error('Message locks lost')); });
  });
}
function verifyOwner() {
  const code = "$ErrorActionPreference='Stop'; $ls=@(Get-NetTCPConnection -State Listen -LocalPort 8563 | Where-Object {$_.LocalAddress -eq '127.0.0.1'}); if($ls.Count -ne 1){exit 1}; $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ls[0].OwningProcess); if($p.ExecutablePath -ine 'E:\\mystic\\mis.exe'){exit 1}; Write-Output 'SANDBOX_OWNER_VERIFIED'";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', code], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  if (result.status !== 0 || !result.stdout.includes('SANDBOX_OWNER_VERIFIED')) throw new Error('Listener ownership unavailable');
}
function loadSession() {
  const filename = path.resolve(__dirname, '../src/lib/auth/nntps.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod); mod.require = id => id === 'server-only' ? {} : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  return mod.exports.NntpsSession;
}
function pauseHeartbeat() { clearInterval(heartbeat); heartbeat = undefined; return pendingHeartbeat; }
function resumeHeartbeat() {
  heartbeat = setInterval(() => {
    pendingHeartbeat = pendingHeartbeat.then(async () => {
      for (const session of sessions) { try { await session.ping(); } catch { heartbeatFailed = true; } }
    });
  }, 8000);
}
async function waitForPlan(plan) {
  console.log('\nPHASE: ' + plan.name);
  console.log('In the E: editor only, set TestNET group ID 2 ACS = ' + plan.group);
  for (const [id, list, read] of plan.areas) console.log(`Area ID ${id}: ListACS=${list}; ReadACS=${read}`);
  if (plan.locked !== undefined) console.log('User ID 1 Locked Out = ' + (plan.locked ? 'Yes' : 'No'));
  console.log('Keep the same accounts, group IDs, newsgroup names, message paths and message files.');
  while (true) {
    const answer = await ask('Save those editor settings, then press Enter (Q to stop): ');
    if (answer.toLowerCase() === 'q') throw new Error('Operator stopped');
    const config = snapshot();
    if (config.topology !== topology) throw new Error('Fixture topology changed');
    if (matches(plan, config)) return;
    console.log('SETUP_NOT_MATCHED: no native access probe sent. Check the settings above.');
  }
}
async function observe(plan) {
  await pauseHeartbeat();
  if (heartbeatFailed || locker.exitCode !== null) throw new Error('Existing connection or locks lost');
  const config = snapshot(); if (!matches(plan, config) || config.topology !== topology) throw new Error('Fixture changed');
  const observations = [];
  for (let account = 0; account < sessions.length; account++) {
    let visible;
    try { visible = await sessions[account].groups(); }
    catch (error) {
      observations.push({ userId: accounts[account].id, listAvailable: false, stage: error.stage, status: error.statusCode ?? null });
      continue;
    }
    if (visible.some(name => config.privateNames.includes(name))) throw new Error('Private metadata exposed');
    for (const id of plan.targets) {
      const area = config.areas.get(id); let selected = false, status = null, available = true;
      try { await sessions[account].probeGroup(area.group); selected = true; }
      catch (error) {
        status = error.statusCode ?? null;
        // Only complete, known GROUP denials preserve diagnostic connections.
        // No reconnect or saved password may replace the original live session.
        available = status !== null;
      }
      observations.push({ userId: accounts[account].id, areaId: id, listed: visible.includes(area.group), selected, nativeStatus: status, responseAvailable: available });
    }
  }
  if (snapshot().revision !== config.revision) throw new Error('Catalog changed during observation');
  const passed = plan.check(observations);
  emit({ phase: plan.name, result: passed ? 'PASS' : 'FAIL_OR_INCONCLUSIVE', observations,
    directMessageReads: 'NOT_RUN_POLICY_NOT_CERTIFIED', browserEnabled: false });
  return passed;
}

const find = (rows, user, area) => rows.find(r => r.userId === user && r.areaId === area);
const positive = (rows, user, area) => { const r = find(rows, user, area); return r?.listed === true && r?.selected === true; };
const deniedSelection = (rows, user, area) => { const r = find(rows, user, area); return r?.selected === false && [411, 450, 480, 481, 502].includes(r.nativeStatus); };

async function main() {
  if (process.platform !== 'win32' || path.resolve(__dirname, '..').toLowerCase() !== 'e:\\work\\javadude_dev\\mysticweb') throw new Error('Sandbox checkout required');
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--preflight')) throw new Error('Unsupported arguments');
  const current = snapshot();
  for (const account of accounts) accountFlags(account.id);
  verifyOwner(); await acquireLocks();
  const pinned = snapshot();
  if (pinned.catalogHash !== lockedCatalogHash || pinned.topology !== current.topology) throw new Error('Fixture changed during lock acquisition');
  topology = pinned.topology;
  emit({ phase: 'PREFLIGHT', result: 'PASS', messageWritePrevention: 'WINDOWS_READ_SHARING_LOCKS',
    fixtureAreaIds: [...current.areas.keys()], userIds: [1, 2], credentialsReadFromFiles: false });
  if (process.argv[2] === '--preflight') return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive terminal required');
  operatorRun = true;
  const identity = { name: 'IDENTITY_AND_LIST_BASELINE', group: 's0', areas: [[2, 'u1', 'u1'], [5, 'u2', 'u2']],
    targets: [2, 5], check: rows => positive(rows, 1, 2) && positive(rows, 2, 5) && find(rows, 1, 5)?.listed === false && find(rows, 2, 2)?.listed === false };
  console.log('Native identity/access fixture verification only. No browser sessions will be created.');
  console.log('NNTPS still has no general permanent-ID/current-eligibility query; U# fixtures are experimental evidence, not a production identity adapter.');
  await waitForPlan(identity);
  const NntpsSession = loadSession();
  const endpoint = { host: '127.0.0.1', port: 8563, servername: 'mybbs.com', ca: fs.readFileSync(path.resolve(__dirname, '../.certificates/mystic-sandbox-cert.pem')) };
  for (const account of accounts) {
    console.log('Authenticate disposable fixture user ID ' + account.id + ' (' + account.handle + ').');
    let password = await hiddenPassword();
    try { sessions.push(await NntpsSession.login(endpoint, account.handle, password)); }
    finally { password = ''; }
    if (!heartbeat) resumeHeartbeat();
  }
  await pauseHeartbeat();
  if (heartbeatFailed) throw new Error('Existing connection lost');
  // Probe each account's own area first. Native U# evaluation supplies only
  // controlled-fixture evidence; it is not a general production identity API.
  // Record both accounts and both area selections even when an expected
  // allowed group is denied. A 411 is evidence to diagnose, not a grant.
  const identityPassed = await observe(identity);
  if (!identityPassed) {
    console.log('BASELINE_NOT_VERIFIED: observations above distinguish LIST visibility from GROUP selection. Do not change more ACS settings yet.');
    process.exitCode = 1; return;
  }
  resumeHeartbeat();
  const read = { name: 'INDEPENDENT_READ_ACS', group: 's0', areas: [[2, 's0', 'u1'], [5, 'u2', 'u2']], targets: [2],
    check: rows => positive(rows, 1, 2) && deniedSelection(rows, 2, 2) };
  await waitForPlan(read);
  const readPassed = await observe(read);
  resumeHeartbeat();
  const list = { name: 'INDEPENDENT_LIST_ACS', group: 's0', areas: [[2, 'u1', 's0'], [5, 'u2', 'u2']], targets: [2],
    check: rows => find(rows, 1, 2)?.listed === true && find(rows, 2, 2)?.listed === false };
  await waitForPlan(list); const listPassed = await observe(list); resumeHeartbeat();
  const group = { name: 'INDEPENDENT_GROUP_ACS', group: 'u1', areas: [[2, 'u1', 'u1'], [5, 's0', 's0']], targets: [5],
    check: rows => positive(rows, 1, 5) && find(rows, 2, 5)?.listed === false && deniedSelection(rows, 2, 5) };
  await waitForPlan(group); const groupPassed = await observe(group); resumeHeartbeat();
  const context = { name: 'CANDIDATE_AREA_GROUP_CONTEXT', group: 's0', areas: [[2, 'u1', 'u1'], [5, 'g2', 'g2']], targets: [5],
    check: rows => positive(rows, 1, 5) && positive(rows, 2, 5) };
  await waitForPlan(context); const contextPassed = await observe(context); resumeHeartbeat();
  const wrongContext = { name: 'WRONG_GROUP_CONTEXT_DENIAL', group: 's0', areas: [[2, 'u1', 'u1'], [5, 'g1', 'g1']], targets: [5],
    check: rows => deniedSelection(rows, 1, 5) && deniedSelection(rows, 2, 5) };
  await waitForPlan(wrongContext); const wrongContextPassed = await observe(wrongContext); resumeHeartbeat();
  const baseline = { ...identity, name: 'REVOCATION_BASELINE', targets: [2, 5], locked: false,
    check: rows => positive(rows, 1, 2) && positive(rows, 2, 5) };
  await waitForPlan(baseline); const beforeRevocation = await observe(baseline); resumeHeartbeat();
  const revoked = { name: 'LIVE_READ_PERMISSION_REVOCATION', group: 's0', areas: [[2, 'u1', '!u1'], [5, 'u2', 'u2']], targets: [2],
    check: rows => beforeRevocation && deniedSelection(rows, 1, 2) };
  await waitForPlan(revoked); const revokedPassed = await observe(revoked); resumeHeartbeat();
  await waitForPlan(baseline); const beforeLock = await observe(baseline); resumeHeartbeat();
  const locked = { ...baseline, name: 'LIVE_ACCOUNT_LOCK_REVOCATION', locked: true,
    check: rows => beforeLock && positive(rows, 2, 5) && (
      deniedSelection(rows, 1, 2) || rows.some(r => r.userId === 1 && r.listAvailable === false && [450, 480, 481, 502].includes(r.status))) };
  await waitForPlan(locked); const lockPassed = await observe(locked);
  emit({ phase: 'CERTIFICATION_GATE', result: 'BLOCKED',
    identityFixture: identityPassed, listACS: listPassed, readACSMetadata: readPassed, groupACS: groupPassed,
    areaGroupContext: contextPassed && wrongContextPassed, permissionRevocation: revokedPassed, existingAccountLockRevocation: lockPassed,
    generalPermanentIdentityBinding: 'NO_SUPPORTED_NNTPS_QUERY_FOUND', completeCurrentEligibility: 'NOT_CERTIFIED',
    directMessageRequests: 'NOT_RUN_UNTIL_POLICY_CERTIFIED', isolatedBrowserSessions: 'NOT_ACTIVATED', browserEnabled: false });
  process.exitCode = [identityPassed, listPassed, readPassed, groupPassed, contextPassed, wrongContextPassed, revokedPassed, lockPassed].every(Boolean) ? 2 : 1;
}

main().catch(error => {
  const safe = new Set(['Sandbox boundary', 'Linked root', 'Linked component', 'Listener ownership unavailable', 'Write prevention unavailable', 'Lock timeout', 'Message locks lost', 'Existing connection or locks lost', 'Existing connection lost', 'Fixture topology changed', 'Fixture changed', 'Fixture changed during lock acquisition', 'Private metadata exposed', 'Operator stopped', 'Catalog changed during observation']);
  emit({ phase: 'RUN', result: 'STOPPED', safetyReason: safe.has(error.message) ? error.message : 'UNAVAILABLE', errorClass: error.name, nativeStage: error.stage ?? null, nativeStatus: error.statusCode ?? null, browserEnabled: false });
  process.exitCode = 1;
}).finally(async () => {
  await pauseHeartbeat();
  for (const session of sessions) { try { await session.quit(); } catch { session.close(); } }
  if (locker && locker.exitCode === null) { locker.stdin.end('release\n'); }
  console.log('MESSAGE_FILES_AND_READ_POINTERS_UNCHANGED_BY_TOOL; BROWSER_LOGIN_DISABLED');
  if (operatorRun) console.log('Restore fixture settings in the E: editor: user ID 1 Locked Out=No; area 2 ListACS/ReadACS=s10g1; area 5=s10g2; TestNET group 2 ACS=s10.');
});
