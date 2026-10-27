#!/usr/bin/env node
/* Read-only, local-only Mystic configuration validation.
 * Does not output message-area names, JAM filenames, or security expressions.
 * Run on the Ubuntu BBS host after npm install: npm run mystic:validate
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const sourceFile = path.resolve(__dirname, "../src/lib/mystic/config.ts");
const source = fs.readFileSync(sourceFile, "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;
const loaded = new Module(sourceFile, module);
loaded.filename = sourceFile;
loaded.paths = Module._nodeModulePaths(path.dirname(sourceFile));
const originalRequire = loaded.require.bind(loaded);
loaded.require = (id) => (id === "server-only" ? {} : originalRequire(id));
loaded._compile(js, sourceFile);

async function main() {
  const { readMysticConfiguration } = loaded.exports;
  const { groups, areas } = await readMysticConfiguration();
  const groupIds = new Set(groups.map((group) => group.id));
  const inferred = areas.filter((area) => area.inferredGroupId !== null);
  const unresolved = areas.length - inferred.length;
  const missingJamBase = areas.filter((area) => !area.jamBase.trim()).length;
  const invalidRefs = inferred.filter((area) => !groupIds.has(area.inferredGroupId)).length;

  console.log("Mystic configuration validation (read-only)");
  console.log(`Group records: ${groups.length}`);
  console.log(`Area records: ${areas.length}`);
  console.log(`Areas with one inferred security group: ${inferred.length}`);
  console.log(`Areas without one unambiguous group: ${unresolved}`);
  console.log(`Areas with blank JAM base field: ${missingJamBase}`);
  console.log(`Invalid inferred group references: ${invalidRefs}`);
  console.log("NOTE: Group inference is not authorization; no message content was read.");
  if (invalidRefs) process.exitCode = 1;
}

main().catch((error) => {
  // Do not print filesystem paths or raw record content.
  console.error(`Validation failed: ${error instanceof Error ? error.message.replace(/\/[^\s:]*/g, "[path]") : "unknown error"}`);
  process.exitCode = 1;
});
