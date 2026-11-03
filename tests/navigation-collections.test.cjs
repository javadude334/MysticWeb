const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/lib/navigation/navigation-collections.ts");
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { navigationCollections, collectionIds } = mod.exports;
const { defaultNavigation } = (() => {
  const name = path.resolve(__dirname, "../src/lib/navigation/default-navigation.ts");
  const m = new Module(name, module); m.filename = name;
  m.paths = Module._nodeModulePaths(path.dirname(name));
  m._compile(ts.transpileModule(fs.readFileSync(name, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, name);
  return m.exports;
})();
test("navigation collections are nested, ordered, and reference only known links", () => {
  const ids = [], links = [];
  function walk(nodes, depth) {
    assert.ok(depth < 8);
    for (const node of nodes) {
      if (node.type === "collection") {
        assert.match(node.id, /^[a-z][a-z0-9-]+$/);
        assert.ok(node.title && node.icon);
        ids.push(node.id);
        walk(node.children, depth + 1);
      } else {
        assert.equal(node.type, "link");
        links.push(node.href);
      }
    }
  }
  walk(navigationCollections, 0);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(links).size, links.length);
  assert.deepEqual(collectionIds(), ids);
  const known = new Set(defaultNavigation.filter(item => item.enabled !== false).map(item => item.href));
  assert.deepEqual([...links].sort(), [...known].filter(href => href !== "/dashboard").sort());
  assert.ok(ids.some(id => id.includes("community-")));
});
