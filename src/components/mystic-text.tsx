import { parseMysticText } from "@/lib/mystic/text-format";

/** Render Mystic pipe colors and supported ANSI SGR safely as escaped React text. */
export function MysticText({ text }: { text: string }) {
  return <>{parseMysticText(text).map((run, i) =>
    <span key={i} style={{
      ...(run.color ? { color: run.color } : {}),
      ...(run.backgroundColor ? { backgroundColor: run.backgroundColor } : {}),
      ...(run.bold ? { fontWeight: 700 } : {}),
    }}>{run.text}</span>
  )}</>;
}
