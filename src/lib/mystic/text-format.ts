/** Safe Mystic pipe-color and ANSI SGR renderer: returns text runs, never HTML. */
export type MysticTextRun = { text: string; color?: string; backgroundColor?: string; bold?: boolean };
const palette = [
  "#000000", "#0000AA", "#00AA00", "#00AAAA",
  "#AA0000", "#AA00AA", "#AA5500", "#AAAAAA",
  "#555555", "#5555FF", "#55FF55", "#55FFFF",
  "#FF5555", "#FF55FF", "#FFFF55", "#FFFFFF",
] as const;
const ansiOrder = [0, 4, 2, 6, 1, 5, 3, 7] as const;
const maxRuns = 8192;

/** Bounded ANSI SGR support. Other terminal controls are discarded, never executed. */
export function parseMysticText(source: string): MysticTextRun[] {
  const runs: MysticTextRun[] = [];
  let color: string | undefined;
  let backgroundColor: string | undefined;
  let bold = false;
  let pending = "";
  const flush = () => {
    if (!pending) return;
    const last = runs[runs.length - 1];
    if (last && last.color === color && last.backgroundColor === backgroundColor && !!last.bold === bold) {
      last.text += pending;
    } else if (runs.length < maxRuns) {
      runs.push({ text: pending, ...(color ? { color } : {}), ...(backgroundColor ? { backgroundColor } : {}), ...(bold ? { bold } : {}) });
    } else {
      // Keep text even when the run limit is reached, without adding styles.
      runs[runs.length - 1].text += pending;
    }
    pending = "";
  };
  const applySGR = (sequence: string) => {
    const parts = sequence === "" ? [0] : sequence.split(";").map(Number);
    if (parts.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return;
    for (let i = 0; i < parts.length; i++) {
      const code = parts[i];
      if (code === 0) { color = undefined; backgroundColor = undefined; bold = false; }
      else if (code === 1) bold = true;
      else if (code === 22) bold = false;
      else if (code === 39) color = undefined;
      else if (code === 49) backgroundColor = undefined;
      else if (code >= 30 && code <= 37) color = palette[ansiOrder[code - 30] + (bold ? 8 : 0)];
      else if (code >= 90 && code <= 97) color = palette[ansiOrder[code - 90] + 8];
      else if (code >= 40 && code <= 47) backgroundColor = palette[ansiOrder[code - 40]];
      else if (code >= 100 && code <= 107) backgroundColor = palette[ansiOrder[code - 100] + 8];
      else if ((code === 38 || code === 48) && parts[i + 1] === 5 && i + 2 < parts.length) {
        // 256-color indices are deliberately not rendered until palette mapping is verified.
        i += 2;
      } else if ((code === 38 || code === 48) && parts[i + 1] === 2 && i + 4 < parts.length) {
        // Discard truecolor safely rather than partially applying its parameters.
        i += 4;
      }
    }
  };
  for (let i = 0; i < source.length;) {
    if (source[i] === "|" && i + 2 < source.length) {
      const code = source.slice(i + 1, i + 3);
      if (/^\d{2}$/.test(code)) {
        const n = Number(code);
        if (n <= 15) { flush(); color = palette[n]; }
        i += 3;
        continue;
      }
      if (/^(CL|CR|PA|PN)$/i.test(code)) { i += 3; continue; }
    }
    if (source[i] === "\x1b") {
      const match = /^\x1b\[([0-9;]*)m/.exec(source.slice(i));
      if (match) { flush(); applySGR(match[1]); i += match[0].length; continue; }
      const control = /^\x1b\[[0-9;?]*[ -/]*[@-~]/.exec(source.slice(i));
      if (control) { i += control[0].length; continue; }
      // Ignore unsupported escape controls, including OSC strings.
      if (source[i + 1] === "]") {
        const end = source.indexOf("\x07", i + 2);
        const terminator = source.indexOf("\x1b\\", i + 2);
        const stop = end < 0 ? terminator : terminator < 0 ? end : Math.min(end, terminator);
        if (stop >= 0) { i = stop + (source[stop] === "\x07" ? 1 : 2); continue; }
      }
      i++;
      continue;
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
