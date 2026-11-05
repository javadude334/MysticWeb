import "server-only";
import { version } from "../../../package.json";

/** Applied at the native write boundary, once per outgoing message. */
export function withMysticWebTagline(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const footer = `---\nPosted with MysticWeb v${version}`;
  if (normalized.endsWith(footer)) return normalized;
  return normalized + "\n\n" + footer;
}
