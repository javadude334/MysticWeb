#!/usr/bin/env node
"use strict";
// Compare two controlled sandbox snapshots of the SAME native account.
// This reports only changed byte positions, never contents, passwords, hashes,
// names or user data. Do not use production users.dat.
const fs = require("node:fs");
const path = require("node:path");
const SIZE = 1536;
const [beforePath, afterPath, idText] = process.argv.slice(2);
if (!beforePath || !afterPath || !/^[1-9][0-9]*$/.test(idText || "")) {
  console.error("Usage: node scripts/compare-native-account.cjs <before-users.dat> <after-users.dat> <user-id>");
  process.exit(2);
}
const id = Number(idText);
if (!Number.isSafeInteger(id) || id > 0x7fffffff ||
    !path.isAbsolute(beforePath) || !path.isAbsolute(afterPath) ||
    path.resolve(beforePath) === path.resolve(afterPath)) {
  console.error("Invalid input"); process.exit(2);
}
function record(filename) {
  const s = fs.lstatSync(filename);
  if (!s.isFile() || s.isSymbolicLink() || !s.size || s.size > 64 * 1024 * 1024 || s.size % SIZE) throw Error("Invalid snapshot");
  const data = fs.readFileSync(filename);
  const matches = [];
  for (let i = 0; i < data.length; i += SIZE) {
    if (data.readUInt32LE(i) === id) matches.push(data.subarray(i, i + SIZE));
  }
  if (matches.length !== 1) throw Error("Missing or duplicate user ID");
  return matches[0];
}
try {
  const a = record(beforePath), b = record(afterPath);
  const changed = [];
  // Exclude password method, iterations, salt, hash and identity strings.
  // The first 109 bytes contain sensitive password material at offsets 8-108.
  for (let i = 109; i < SIZE; i++) if (a[i] !== b[i]) changed.push(i);
  console.log(JSON.stringify({ userId: id, changedOffsetsAfter109: changed, count: changed.length }, null, 2));
  console.log("These offsets are candidates only; verify by reversing the controlled setting.");
} catch {
  console.error("Unable to compare controlled snapshots"); process.exitCode = 1;
}
