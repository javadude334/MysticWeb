const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("sandbox posting requires explicit action and posting permissions", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/lib/auth/sandbox-messages.ts"), "utf8");
  assert.match(source, /search === "\?action=post"/);
  assert.match(source, /access\.canPost\(area\.id\)/);
  assert.match(source, /appendOfflineJam\(jamReal, area\.jamBase/);
  assert.doesNotMatch(source, /MYSTICWEB_OFFLINE_JAM_WRITE/);
  assert.match(source, /Reply parent unavailable/);
  assert.doesNotMatch(source, /author:\s*post\.author/);
  assert.doesNotMatch(source, /author:\s*`User #/);
  assert.match(source, /readMysticPostingHandle\(runtime\.usersPath, identity\.userId\)/);
  assert.match(source, /if \(!author\) return json\(/);
});

test("production message posting remains unavailable while read receipts are enabled", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/app/api/messages/route.ts"), "utf8");
  assert.match(source, /process\.env\.MYSTICWEB_ENABLE_NATIVE_LOGIN === "1"/);
  const handler = fs.readFileSync(path.resolve(__dirname, "../src/lib/auth/sandbox-messages.ts"), "utf8");
  assert.match(handler, /request\.method === "POST" && new URL\(request\.url\)\.pathname === "\/api\/messages"/);
  assert.match(handler, /new URL\(request\.url\)\.search === ""/);
  assert.match(handler, /search === "\?action=post"/);
  assert.match(source, /return unavailable\(\)/);
});

test("browser composer connects New Post and Reply to authenticated posting endpoint", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/components/message-workspace.tsx"), "utf8");
  assert.match(source, /onClick=\{\(\) => openComposer\(\)\}/);
  assert.match(source, /onClick=\{\(\) => openComposer\(selected\)\}/);
  assert.match(source, /fetch\("\/api\/messages\?action=post",\s*\{ method: "POST", credentials: "same-origin"/);
  assert.match(source, /"Content-Type": "application\/json"/);
  assert.match(source, /JSON\.stringify\(\{ area: area\.id, recipient:/);
  assert.match(source, /\.\.\.\(composer\.replyTo \? \{ replyTo: composer\.replyTo \} : \{\}\)/);
  assert.match(source, /receipt\.posted !== true/);
  assert.match(source, /pendingSearchMessage\.current = \{ areaId: area\.id, number \}; load\(area\)/);
  assert.match(source, /setComposer\(null\); setNotice\("Posted message #"/);
  assert.match(source, /Posting unavailable\. Your draft is preserved\./);
});

test("posting API verifies current account, authorization and response receipt", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/lib/auth/sandbox-messages.ts"), "utf8");
  assert.match(source, /readNativeAccountSnapshot\(runtime\.usersPath, identity\.userId\)/);
  assert.match(source, /access\.canPost\(area\.id\)/);
  assert.match(source, /readJam\(jamReal, area\.jamBase, \{ message: post\.replyTo/);
  assert.match(source, /return json\(\{ posted: true, area: area\.id, number: result\.number, messageId: result\.messageId \}, 201\)/);
});
