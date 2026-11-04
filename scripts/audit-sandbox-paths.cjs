#!/usr/bin/env node
/* Read-only sandbox path audit. Never prints actual filesystem paths. */
const fs = require("node:fs/promises");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(path.resolve(__dirname, ".."), true);

function within(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}
async function safeFile(root, relative) {
  const target = path.join(root, relative);
  if (!within(root, target)) throw new Error("Invalid relative file");
  const parts = relative.split(/[\\/]+/);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error("Linked path component");
  }
  const real = await fs.realpath(target);
  if (!within(root, real)) throw new Error("File resolves outside sandbox");
  const stat = await fs.stat(real);
  if (!stat.isFile()) throw new Error("Not a regular file");
  return fs.readFile(real);
}
async function main() {
  const configured = process.env.MYSTIC_DATA_ROOT;
  if (!configured || !path.isAbsolute(configured)) throw new Error("Sandbox root not configured");
  const rootStat = await fs.lstat(configured);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Unsafe sandbox root");
  const root = await fs.realpath(configured);
  const expected = ["data/groups_g.dat", "data/mbases.dat", "data/users.dat", "mystic.dat"];
  const sizes = [];
  for (const file of expected) {
    const bytes = await safeFile(root, file);
    sizes.push(bytes.length);
  }
  const native = await safeFile(root, "mystic.dat");
  if (native.length !== 8192) throw new Error("Unexpected native configuration size");
  const length = native[260];
  if (!length || length > 80 || 261 + length > native.length) throw new Error("Invalid message path field");
  const messagePath = native.subarray(261, 261 + length).toString("latin1");
  if (!path.isAbsolute(messagePath) || messagePath.includes("\0")) throw new Error("Invalid message directory");
  const messageReal = await fs.realpath(messagePath);
  const messageStat = await fs.lstat(messagePath);
  if (!messageStat.isDirectory() || messageStat.isSymbolicLink() || !within(root, messageReal))
    throw new Error("Message directory is outside sandbox or linked");
  const entries = await fs.readdir(messageReal);
  console.log("Mystic sandbox path audit (read-only, paths redacted)");
  console.log("Required configuration files: " + sizes.length + " verified");
  console.log("Message directory contained within sandbox: yes");
  console.log("JAM header files found: " + entries.filter(name => /\.jhr$/i.test(name)).length);
  console.log("No Mystic service or socket connection used.");
}
main().catch(() => {
  console.error("Sandbox path audit failed: verify copied paths and junctions before accessing message files.");
  process.exitCode = 1;
});
