#!/usr/bin/env node
"use strict";
/** Controlled, read-only ACS mapping aid. Prints configuration field labels
 * only; does not infer authorization or read message contents.
 */
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
if (!root || !path.isAbsolute(root)) {
  console.error("Usage: node scripts/inspect-acs-groups.cjs <sandbox-mystic-root>");
  process.exit(2);
}
try {
  const filename = path.join(root, "data", "groups_g.dat");
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 206 * 512 ||
      stat.size % 206 !== 0) throw Error();
  const data = fs.readFileSync(filename);
  const groups = [];
  for (let i = 0; i < data.length; i += 206) {
    const r = data.subarray(i, i + 206);
    const length = r[4];
    if (length > 60) throw Error();
    groups.push({ id: r.readUInt32LE(0), name: r.subarray(5, 5 + length).toString("latin1") });
  }
  console.log(JSON.stringify({ groupCount: groups.length, groups }, null, 2));
  console.log("Group names do not establish native membership or ACS eligibility.");
} catch {
  console.error("Unable to inspect sandbox groups"); process.exitCode = 1;
}
