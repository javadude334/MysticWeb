const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/auth/sandbox-origin.ts");
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
const original = m.require.bind(m);
m.require = id => id === "server-only" ? {} : original(id);
m._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { sandboxOrigins, sandboxOriginAllowed } = m.exports;
const keys = ["NODE_ENV", "MYSTICWEB_APP_URL", "MYSTICWEB_ALLOWED_ORIGINS"];
function env(values, fn) {
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, values);
    fn();
  } finally {
    for (const k of keys) old[k] === undefined ? delete process.env[k] : process.env[k] = old[k];
  }
}
function req(url, origin, site = "same-origin") {
  return new Request(url, { headers: { ...(origin ? { origin } : {}), "sec-fetch-site": site } });
}
test("configured localhost and IPv4 loopback allow same-origin mutations and sessions", () => {
  env({ NODE_ENV: "development", MYSTICWEB_APP_URL: "http://localhost:3000",
    MYSTICWEB_ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000" }, () => {
    for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000"]) {
      assert.equal(sandboxOriginAllowed(req(origin + "/api/auth/login", origin), true), true);
      assert.equal(sandboxOriginAllowed(req(origin + "/api/auth/session"), false), true);
      assert.equal(sandboxOriginAllowed(req(origin + "/api/auth/login", "http://evil.example"), true), false);
      assert.equal(sandboxOriginAllowed(req(origin + "/api/auth/login", origin, "cross-site"), true), false);
    }
    assert.equal(sandboxOriginAllowed(req("http://127.0.0.1:30004/api/auth/login", "http://127.0.0.1:30004"), true), false);
  });
});
test("HTTPS production origins work on both davesbbs hostnames", () => {
  env({ NODE_ENV: "production", MYSTICWEB_APP_URL: "https://davesbbs.com" }, () => {
    for (const origin of ["https://davesbbs.com", "https://www.davesbbs.com"]) {
      assert.equal(sandboxOriginAllowed(req(origin + "/api/auth/login", origin), true), true);
      assert.equal(sandboxOriginAllowed(req(origin + "/api/auth/session"), false), true);
      assert.equal(sandboxOriginAllowed(req(origin + "/api/auth/login", "https://evil.example"), true), false);
    }
    assert.equal(sandboxOriginAllowed(req("https://evil.example/api/auth/session"), false), false);
  });
});
test("malformed origins and missing configuration fail closed", () => {
  for (const allowed of ["http://192.168.1.10:3000", "http://localhost:3000/path",
    "http://localhost:3000,", "http://localhost:3000,http://127.0.0.1:30004/path"]) {
    env({ NODE_ENV: "development", MYSTICWEB_APP_URL: "http://localhost:3000",
      MYSTICWEB_ALLOWED_ORIGINS: allowed }, () => assert.equal(sandboxOrigins(), null));
  }
  env({ NODE_ENV: "development" }, () => assert.equal(sandboxOrigins(), null));
});
