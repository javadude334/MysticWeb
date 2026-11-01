import { parseMysticText } from "@/lib/mystic/text-format";

/** Default rendering for text sourced from Mystic BBS. React escapes all text. */
export function MysticText({ text }: { text: string }) {
  return <>{parseMysticText(text).map((run, i) => <span key={i} style={run.color ? { color: run.color } : undefined}>{run.text}</span>)}</>;
}
