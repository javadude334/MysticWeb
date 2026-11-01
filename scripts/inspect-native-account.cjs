#!/usr/bin/env node
// Read-only A48 account-status research. No password, salt, or hash output.
const fs = require("node:fs/promises");
const path = require("node:path");

const RECORD_SIZE = 1536;
const MAX_SIZE = 64 * 1024 * 1024;
const FLAG_BITS = [
  ["locked_bit_0", 0x00000001],
  ["deleted_candidate_bit_2", 0x00000004],
  ["password_change_bit_10", 0x00000400],
];

async function main() {
  const [root, idText] = process.argv.slice(2);
  if (!root || !path.isAbsolute(root) || !/^[1-9]\d{0,9}$/.test(idText || "")) {
    throw new Error("Usage: node scripts/inspect-native-account.cjs <absolute-sandbox-root> <user-id>");
  }
  const id = Number(idText);
  if (!Number.isSafeInteger(id) || id > 0x7fffffff) throw new Error("Invalid user ID");
  const filename = path.join(root, "data", "users.dat");
  const st = await fs.lstat(filename);
  if (!st.isFile() || st.isSymbolicLink() || !st.size || st.size > MAX_SIZE ||
      st.size % RECORD_SIZE !== 0) throw new Error("Invalid sandbox users.dat");
  const file = await fs.open(filename, "r");
  try {
    const record = Buffer.alloc(RECORD_SIZE);
    let found = null;
    for (let pos = 0; pos < st.size; pos += RECORD_SIZE) {
      const { bytesRead } = await file.read(record, 0, RECORD_SIZE, pos);
      if (bytesRead !== RECORD_SIZE) throw new Error("Short read");
      if (record.readUInt32LE(0) !== id) continue;
      if (found) throw new Error("Duplicate permanent user ID");
      const flags = record.readUInt32LE(4);
      found = { userId: id, flagsHex: "0x" + flags.toString(16).padStart(8, "0"),
        ...Object.fromEntries(FLAG_BITS.map(([name, bit]) => [name, Boolean(flags & bit)])) };
    }
    if (!found) throw new Error("Account not found");
    // Status bits are research observations, NOT a full active-account decision.
    console.log(JSON.stringify(found, null, 2));
    console.log("Expiration semantics unverified; web sessions remain disabled.");
  } finally { await file.close(); }
}
main().catch(e => {
  console.error(e.message.startsWith("Usage:") ? e.message : "Cannot inspect sandbox account (path, format, or ID).");
  process.exitCode = 1;
});
