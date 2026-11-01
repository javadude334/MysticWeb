/** Mystic BBS pipe-color text parser. Safe: produces text runs, never HTML. */
export type MysticTextRun = { text: string; color?: string };
const palette = [
  "#000000", "#0000AA", "#00AA00", "#00AAAA",
  "#AA0000", "#AA00AA", "#AA5500", "#AAAAAA",
  "#555555", "#5555FF", "#55FF55", "#55FFFF",
  "#FF5555", "#FF55FF", "#FFFF55", "#FFFFFF",
] as const;

/** Mystic's two-digit color tokens 00–15 use the standard DOS palette. */
export function parseMysticText(source: string): MysticTextRun[] {
  const runs: MysticTextRun[] = [];
  let color: string | undefined;
  let pending = "";
  const flush = () => {
    if (pending) runs.push({ text: pending, ...(color ? { color } : {}) });
    pending = "";
  };
  for (let i = 0; i < source.length;) {
    if (source[i] === "|" && i + 2 < source.length) {
      const code = source.slice(i + 1, i + 3);
      if (/^\d{2}$/.test(code)) {
        const n = Number(code);
        if (n <= 15) { flush(); color = palette[n]; }
        // Other numeric Mystic attributes are non-text directives.
        i += 3;
        continue;
      }
      if (/^(CL|CR|PA|PN)$/i.test(code)) { i += 3; continue; }
    }
    if (source[i] === "\x1b") {
      const match = /^\x1b\[[0-9;?]*[ -/]*[@-~]/.exec(source.slice(i));
      if (match) { i += match[0].length; continue; }
    }
    const ch = source[i++];
    if (ch === "\r") { pending += "\n"; if (source[i] === "\n") i++; }
    else if (ch === "\n" || ch === "\t" || ch >= " ") pending += ch;
  }
  flush();
  return runs;
}

export function plainMysticText(source: string): string {
  return parseMysticText(source).map(run => run.text).join("");
}
