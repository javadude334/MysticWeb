#!/usr/bin/env node
"use strict";
/**
 * Inspect only message-area ACS expressions from a disposable Mystic sandbox.
 * No account files, credentials, or message contents are read. No writes.
 * This is an inventory, NOT an authorization evaluator.
 */
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
if (!root || !path.isAbsolute(root)) {
  console.error("Usage: node scripts/inspect-message-acs.cjs <sandbox-mystic-root>");
  process.exit(2);
}
try {
  const filename = path.join(root, "data", "mbases.dat");
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 768 * 512 ||
      stat.size % 768 !== 0) throw Error("Invalid message area configuration");
  const data = fs.readFileSync(filename);
  const field = (record, offset, max) => {
    const n = record[offset];
    if (n > max) throw Error("Invalid string");
    return record.subarray(offset + 1, offset + 1 + n).toString("latin1");
  };
  const areas = [];
  for (let i = 0; i < data.length; i += 768) {
    const r = data.subarray(i, i + 768);
    areas.push({
      id: r.readUInt16LE(0),
      name: field(r, 2, 60),
      securityExpressions: [263, 294, 325, 356].map(o => field(r, o, 30)),
    });
  }
  console.log(JSON.stringify({ areaCount: areas.length, areas }, null, 2));
  console.log("Expression slots are positional only; their native meaning is not yet verified.");
} catch {
  console.error("Could not inspect sandbox message area configuration");
  process.exitCode = 1;
}
