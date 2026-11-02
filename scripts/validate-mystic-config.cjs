#!/usr/bin/env node
/* Read-only, local-only Mystic configuration validation.
 * Does not output message-area names, JAM filenames, or security expressions.
 * Run on the Ubuntu BBS host after npm install: npm run mystic:validate
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { loadEnvConfig } = require("@next/env");

// Standalone scripts do not inherit Next.js .env.local loading. Preserve
// explicitly exported environment variables and use development env files.
loadEnvConfig(path.resolve(__dirname, ".."), true);

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

  // Aggregate ACS inventory only. Never print expressions or assume an ACS
  // expression can be evaluated from a numeric security level alone.
  const acsLabels = ["List ACS", "Read ACS", "Post ACS", "Sysop ACS"];
  const acsStats = acsLabels.map((label, index) => {
    const values = areas.map((area) => area.security[index].trim());
    return {
      label,
      blank: values.filter((value) => value.length === 0).length,
      nonblank: values.filter((value) => value.length > 0).length,
      distinct: new Set(values.filter(Boolean)).size,
    };
  });
  console.log("Mystic configuration validation (read-only)");
  console.log(`Group records: ${groups.length}`);
  console.log(`Area records: ${areas.length}`);
  console.log(`Areas with one inferred security group: ${inferred.length}`);
  console.log(`Areas without one unambiguous group: ${unresolved}`);
  console.log(`Areas with blank JAM base field: ${missingJamBase}`);
  console.log(`Invalid inferred group references: ${invalidRefs}`);
  for (const stat of acsStats) {
    console.log(`${stat.label}: blank=${stat.blank}, nonblank=${stat.nonblank}, distinct_nonblank=${stat.distinct}`);
  }
  // Inventory syntax without exposing actual ACS values, usernames or paths.
  // This is lexical classification only, never a permission decision.
  const fields = ["List", "Read", "Post", "Sysop"];
  const tokens = new Map();
  const syntax = { parentheses: 0, pipes: 0, ampersands: 0, bangs: 0, comparison: 0,
    whitespace: 0, otherPunctuation: 0, nonAscii: 0, empty: 0 };
  const refsByField = fields.map(() => new Set());
  const distinctPatterns = new Set();
  let crossFieldGroupMismatch = 0;
  let noGroupReferences = 0;
  let multipleGroupReferences = 0;
  let unknownGroupReferences = 0;
  let invalidJamNames = 0;
  let duplicateJamNames = 0;
  const jamNames = new Set();
  const groupUsage = new Map();
  const invalidName = (name) => !/^[a-zA-Z0-9_][a-zA-Z0-9_&!'.-]{0,39}$/.test(name) || name.includes("..");
  for (const area of areas) {
    const base = area.jamBase;
    if (invalidName(base)) invalidJamNames++;
    const baseKey = base.toLowerCase();
    if (jamNames.has(baseKey)) duplicateJamNames++;
    jamNames.add(baseKey);
    const perAreaRefs = new Set();
    const perFieldRefs = [];
    for (let index = 0; index < 4; index++) {
      const expression = area.security[index].trim();
      if (!expression) syntax.empty++;
      const refs = [...expression.matchAll(/g([0-9]+)/gi)].map((m) => Number(m[1]));
      const set = new Set(refs);
      perFieldRefs.push(set);
      for (const id of set) {
        perAreaRefs.add(id);
        refsByField[index].add(id);
      }
      // Letter-prefixed token names are grouped by prefix only; no token
      // parameters, group numbers, security levels or raw expressions are shown.
      for (const match of expression.matchAll(/[A-Za-z]+/g)) {
        const key = match[0][0].toUpperCase();
        tokens.set(key, (tokens.get(key) || 0) + 1);
      }
      if (/[()]/.test(expression)) syntax.parentheses++;
      if (expression.includes("|")) syntax.pipes++;
      if (expression.includes("&")) syntax.ampersands++;
      if (expression.includes("!")) syntax.bangs++;
      if (/[<>=]/.test(expression)) syntax.comparison++;
      if (/\s/.test(expression)) syntax.whitespace++;
      if (/[^A-Za-z0-9\s()|&!<>=+\-]/.test(expression)) syntax.otherPunctuation++;
      if (/[^\x00-\x7f]/.test(expression)) syntax.nonAscii++;
      // Normalize digits and alphabetic literals to avoid emitting values.
      distinctPatterns.add(expression.replace(/[0-9]+/g, "#").replace(/[A-Za-z]+/g, "A"));
    }
    if (perAreaRefs.size === 0) noGroupReferences++;
    if (perAreaRefs.size > 1) multipleGroupReferences++;
    if ([...perAreaRefs].some((id) => !groupIds.has(id))) unknownGroupReferences++;
    const listRefs = perFieldRefs[0], readRefs = perFieldRefs[1];
    if (listRefs.size && readRefs.size &&
        (listRefs.size !== readRefs.size || [...listRefs].some((id) => !readRefs.has(id)))) {
      crossFieldGroupMismatch++;
    }
    for (const id of perAreaRefs) groupUsage.set(id, (groupUsage.get(id) || 0) + 1);
  }
  console.log("ACS structural diagnostics (no expression values):");
  console.log(`Distinct normalized syntax shapes: ${distinctPatterns.size}`);
  console.log(`Leading-letter token counts: ${[...tokens].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}`);
  for (const key of Object.keys(syntax)) console.log(`ACS expressions containing ${key}: ${syntax[key]}`);
  console.log(`Group references by field (distinct): ${fields.map((label, i) => `${label}=${refsByField[i].size}`).join(", ")}`);
  console.log(`Areas without any group reference: ${noGroupReferences}`);
  console.log(`Areas with multiple distinct group references: ${multipleGroupReferences}`);
  console.log(`Areas referencing unknown groups: ${unknownGroupReferences}`);
  console.log(`Areas with different List/Read group-reference sets: ${crossFieldGroupMismatch}`);
  console.log(`Distinct referenced group IDs: ${groupUsage.size}`);
  console.log(`Invalid JAM base names: ${invalidJamNames}`);
  console.log(`Duplicate JAM base names (case-insensitive): ${duplicateJamNames}`);
  // Targeted exception report: numeric area IDs and structural syntax only.
  // Never output names, paths, raw ACS values or numeric ACS operands.
  const exceptionAreas = [];
  const shapeCounts = new Map();
  const fieldShapes = fields.map(() => new Map());
  const unusualChars = new Map();
  const exactGrammar = /^(?:[gGsS][0-9]+)+$/;
  const grammarCounts = { matchingConcatenatedGS: 0, other: 0 };
  for (const area of areas) {
    const issues = [];
    const allRefs = new Set();
    const shapes = [];
    for (let i = 0; i < 4; i++) {
      const expr = area.security[i].trim();
      const shape = expr.replace(/[0-9]+/g, "#").replace(/[A-Za-z]+/g, "A");
      shapes.push(shape);
      fieldShapes[i].set(shape, (fieldShapes[i].get(shape) || 0) + 1);
      shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1);
      if (exactGrammar.test(expr)) grammarCounts.matchingConcatenatedGS++;
      else {
        grammarCounts.other++;
        issues.push(fields[i] + " ACS outside basic G/S grammar");
      }
      for (const match of expr.matchAll(/g([0-9]+)/gi)) allRefs.add(Number(match[1]));
      for (const ch of expr) {
        if (!/[A-Za-z0-9]/.test(ch)) {
          const code = "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
          unusualChars.set(code, (unusualChars.get(code) || 0) + 1);
        }
      }
    }
    if (allRefs.size === 0) issues.push("no G reference");
    if (allRefs.size > 1) issues.push("multiple G references");
    if ([...allRefs].some((id) => !groupIds.has(id))) issues.push("unknown G reference");
    if (invalidName(area.jamBase)) issues.push("JAM base incompatible with current reader");
    if (issues.length) exceptionAreas.push({ id: area.id, issues: [...new Set(issues)] });
  }
  const printShapes = (counts) => [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([shape, count]) => `${JSON.stringify(shape)}:${count}`).join(", ");
  console.log("Targeted ACS compatibility report (values and operands redacted):");
  console.log(`G/S concatenation grammar matches: ${grammarCounts.matchingConcatenatedGS}`);
  console.log(`Expressions outside basic G/S grammar: ${grammarCounts.other}`);
  console.log(`Normalized shapes across all fields: ${printShapes(shapeCounts)}`);
  for (let i = 0; i < 4; i++) console.log(`${fields[i]} normalized shapes: ${printShapes(fieldShapes[i])}`);
  console.log(`Non-alphanumeric ACS character codes: ${[...unusualChars].sort().map(([code, count]) => `${code}=${count}`).join(", ") || "none"}`);
  console.log(`Exception area IDs and categories: ${exceptionAreas.length}`);
  for (const area of exceptionAreas) console.log(`  Area #${area.id}: ${area.issues.join("; ")}`);
  console.log("NOTE: Shape classification does not establish native ACS semantics or per-user access.");
  console.log("NOTE: This diagnostic cannot verify user group membership, native ACS evaluation, area type or per-user permissions.");
  console.log("NOTE: ACS expressions are not evaluated; blank ACS is not an authorization grant.");
  console.log("NOTE: Group inference is not authorization; no message content was read.");
  if (invalidRefs || unknownGroupReferences || invalidJamNames) process.exitCode = 1;
}

main().catch((error) => {
  // Do not print filesystem paths or raw record content.
  console.error(`Validation failed: ${error instanceof Error ? error.message.replace(/\/[^\s:]*/g, "[path]") : "unknown error"}`);
  process.exitCode = 1;
});
