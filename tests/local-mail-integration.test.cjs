const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
test("private mail route never enables production writes", () => {
  const route = fs.readFileSync(path.resolve(__dirname, "../src/app/api/mail/route.ts"), "utf8");
  assert.match(route, /NODE_ENV !== "development"/);
});
test("local mail API validates recipient IDs against native users.dat", () => {
  const api = fs.readFileSync(path.resolve(__dirname, "../src/lib/auth/sandbox-messages.ts"), "utf8");
  assert.match(api, /resolveLocalRecipient\(runtime\.usersPath, draft\.recipientId/);
  assert.match(api, /privateMail: true/);
  assert.match(api, /MYSTICWEB_LOCAL_MAIL_BASE/);
  assert.match(api, /readLocalMailbox\(jamReal, configured, author/);
});
test("local mail UI includes inbox sent compose and native user autocomplete", () => {
  const ui = fs.readFileSync(path.resolve(__dirname, "../src/components/local-mail-workspace.tsx"), "utf8");
  for (const term of ["Inbox", "Sent", "Compose", "Reply", "recipientLookup=", "/api/mail"])
    assert.ok(ui.includes(term), term);
});
