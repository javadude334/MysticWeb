"use strict";
// Offline Mystic A47 catalog refresh. No web server or maintenance token required.
// Intentionally uses only Node built-ins so Mystic's Shell event can invoke it.
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function fail(message) { throw new Error(message); }
function pascal(bytes, offset, max, required = false) {
  const length = bytes[offset];
  if (length > max || (required && length === 0)) fail("Invalid Mystic Pascal string");
  const value = bytes.subarray(offset + 1, offset + 1 + length).toString("latin1");
  if (/[\x00-\x1f]/.test(value)) fail("Invalid Mystic string");
  return value;
}
function envRoot() {
  if (process.env.MYSTIC_DATA_ROOT) return process.env.MYSTIC_DATA_ROOT;
  // Only read the installation root; do not evaluate or echo other secrets.
  const filename = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(filename)) fail("MYSTIC_DATA_ROOT is required (environment or .env.local)");
  const line = fs.readFileSync(filename, "utf8").split(/\r?\n/)
    .find(line => /^\s*MYSTIC_DATA_ROOT\s*=/.test(line));
  if (!line) fail("MYSTIC_DATA_ROOT is missing from .env.local");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}
function directories() {
  if (process.platform !== "win32") fail("Only verified Mystic A47 Windows installations are supported");
  const root = path.win32.resolve(envRoot());
  if (!/^[a-z]:\\/i.test(root)) fail("Invalid local Mystic root");
  const data = fs.readFileSync(path.win32.join(root, "mystic.dat"));
  if (data.length !== 8192 || data[0] !== 8 || data.toString("ascii", 1, 9) !== "1.12 A47")
    fail("Unsupported Mystic version");
  if (path.win32.resolve(pascal(data, 17, 80, true)).toLowerCase() !== root.toLowerCase())
    fail("Mystic root mismatch");
  const resolveField = offset => path.win32.resolve(root, pascal(data, offset, 80, true));
  const dataDir = resolveField(98), messageDir = resolveField(260);
  if (![dataDir, messageDir].every(p => /^[a-z]:\\/i.test(p))) fail("Invalid Mystic directories");
  return { dataDir, messageDir };
}
function scan({ dataDir, messageDir }) {
  const file = path.win32.join(dataDir, "mbases.dat");
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.size > 8 * 1024 * 1024 || st.size % 768)
    fail("Invalid mbases.dat");
  const bytes = fs.readFileSync(file), areas = [], ids = new Set();
  for (let off = 0; off < bytes.length; off += 768) {
    const r = bytes.subarray(off, off + 768), id = r.readUInt16LE(0);
    if (ids.has(id)) fail("Duplicate area ID");
    ids.add(id);
    areas.push({ id, name: pascal(r, 2, 60), jamBase: pascal(r, 138, 40),
      storagePath: pascal(r, 179, 80), type: r[260] });
  }
  const local = areas.find(a => a.type === 0 && a.jamBase.toLowerCase() === "email")
    ?? areas.find(a => a.type === 0 && a.id === 1);
  const bases = [], skipped = [], seen = new Set();
  for (const area of areas) {
    const category = area.type === 3 ? "netmail" : area.type === 1 ? "echomail"
      : area.type === 0 && area.id === local?.id ? "local" : null;
    if (!category) continue;
    try {
      if (!area.name.trim() || !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,39}$/.test(area.jamBase) ||
          area.jamBase.includes("..")) fail("Invalid area name or JAM filename");
      const dir = area.storagePath.trim() ? path.win32.resolve(area.storagePath) : messageDir;
      if (!/^[a-z]:\\/i.test(dir) || !path.win32.isAbsolute(dir)) fail("Invalid message directory");
      const resolved = fs.realpathSync.native(dir);
      if (!fs.lstatSync(resolved).isDirectory()) fail("Invalid message directory");
      for (const ext of ["jhr", "jdx", "jdt"]) {
        const filename = path.win32.join(resolved, area.jamBase + "." + ext);
        const st = fs.lstatSync(filename);
        if (!st.isFile() || st.isSymbolicLink()) fail("Unsafe JAM file");
        const actual = fs.realpathSync.native(filename);
        if (path.win32.dirname(actual).toLowerCase() !== resolved.toLowerCase()) fail("JAM path escape");
        if (ext === "jhr") {
          if (st.size < 1024) fail("Invalid JAM header");
          const fd = fs.openSync(actual, "r");
          try {
            const header = Buffer.alloc(24);
            if (fs.readSync(fd, header, 0, 24, 0) !== 24 ||
                header.toString("ascii", 0, 3) !== "JAM" || header[3] !== 0 ||
                header.readUInt32LE(16) !== 0xffffffff || header.readUInt32LE(20) === 0)
              fail("Invalid or protected JAM header");
          } finally { fs.closeSync(fd); }
        }
        if (ext === "jdx" && st.size % 8) fail("Invalid JAM index");
      }
      const key = path.win32.join(resolved, area.jamBase).toLowerCase();
      if (seen.has(key)) fail("Duplicate JAM base path");
      seen.add(key);
      bases.push({ areaId: area.id, name: area.name, category, jamBase: area.jamBase, directory: resolved });
    } catch (error) { skipped.push({ areaId: area.id, reason: error.message }); }
  }
  return { bases, skipped };
}
function main() {
  const dirs = directories();
  const result = scan(dirs);
  // Never create a new database or private directory from an unattended event.
  // Startup initializes schema and applies protected Windows ACLs first.
  const dbDir = path.win32.join(fs.realpathSync.native(dirs.dataDir), "mysticweb");
  const filename = path.win32.join(dbDir, "mysticweb.db");
  if (fs.lstatSync(dbDir).isSymbolicLink() || !fs.lstatSync(dbDir).isDirectory() ||
      fs.lstatSync(filename).isSymbolicLink() || !fs.lstatSync(filename).isFile())
    fail("MysticWeb private database must be initialized first");
  const db = new DatabaseSync(filename, { timeout: 5000 });
  try {
    if (Number(db.prepare("PRAGMA user_version").get().user_version) !== 2)
      fail("MysticWeb database schema version 2 is required");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("DELETE FROM discovered_message_bases");
      const insert = db.prepare(`INSERT INTO discovered_message_bases
        (area_id, name, category, jam_base, directory, refreshed_at)
        VALUES (?, ?, ?, ?, ?, ?)`);
      const now = Date.now();
      for (const b of result.bases)
        insert.run(b.areaId, b.name, b.category, b.jamBase, b.directory, now);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
  const counts = { local: 0, netmail: 0, echomail: 0, skipped: result.skipped.length };
  for (const base of result.bases) counts[base.category]++;
  process.stdout.write(JSON.stringify({ updated: true, counts, skipped: result.skipped }, null, 2) + "\n");
}
try { main(); } catch (error) {
  process.stderr.write("MysticWeb catalog refresh failed: " + error.message + "\n");
  process.exitCode = 1;
}
