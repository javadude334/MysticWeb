const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/mystic/text-format.ts");
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { parseMysticText, plainMysticText } = m.exports;

test("ANSI foreground, background and reset are scoped to runs", () => {
  const runs = parseMysticText("a\x1b[31;44mRED\x1b[0mz");
  assert.deepEqual(runs, [
    { text: "a" },
    { text: "RED", color: "#AA0000", backgroundColor: "#0000AA" },
    { text: "z" },
  ]);
});
test("Mystic pipe colors and ANSI can coexist", () => {
  const runs = parseMysticText("|12red\x1b[1mbright\x1b[0mplain");
  assert.equal(runs[0].color, "#FF5555");
  assert.equal(runs[1].bold, true);
  assert.equal(runs[2].color, undefined);
});
test("unsupported ANSI cursor controls never become visible text", () => {
  assert.equal(plainMysticText("A\x1b[2JB\x1b[31mC"), "ABC");
});
test("OSC hyperlinks are stripped, not interpreted", () => {
  assert.equal(plainMysticText("A\x1b]8;;https://example.org\x07B"), "AB");
});
test("CRLF and CP437-decoded Unicode blocks retain alignment", () => {
  assert.equal(plainMysticText("██\r\n░░"), "██\n░░");
});
