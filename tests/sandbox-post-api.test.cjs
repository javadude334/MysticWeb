const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("sandbox posting requires explicit action and offline writer gate", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/lib/auth/sandbox-messages.ts"), "utf8");
  assert.match(source, /search === "\?action=post"/);
  assert.match(source, /access\.canPost\(area\.id\)/);
  assert.match(source, /appendOfflineJam\(jamReal, area\.jamBase/);
  assert.match(source, /MYSTICWEB_OFFLINE_JAM_WRITE/);
  assert.match(source, /Reply parent unavailable/);
  assert.doesNotMatch(source, /author:\s*post\.author/);
});

test("production message POST remains unavailable", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/app/api/messages/route.ts"), "utf8");
  assert.match(source, /if \(process\.env\.NODE_ENV === "development"\) return sandboxMessages\(request\)/);
  assert.match(source, /return unavailable\(\)/);
});
