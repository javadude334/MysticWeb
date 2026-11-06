/** Parse a recipient of the form name@zone:net/node[.point].
 * Nodelist lookup is advisory, never a prerequisite for composition.
 */
export interface FtnRecipient {
  readonly name: string;
  readonly address: string;
  readonly zone: number;
  readonly net: number;
  readonly node: number;
  readonly point: number;
}
export function parseFtnRecipient(input: string): FtnRecipient | null {
  if (typeof input !== "string" || input.length > 120) return null;
  const match = /^([^@\x00-\x1f\x7f]{1,60})@([0-9]{1,5}):([0-9]{1,5})\/([0-9]{1,5})(?:\.([0-9]{1,5}))?$/.exec(input.trim());
  if (!match || !match[1].trim() || match[1] !== match[1].trim()) return null;
  const [zone, net, node, point] = [match[2], match[3], match[4], match[5] ?? "0"].map(Number);
  if (zone < 1 || zone > 65535 || [net, node, point].some(n => n < 0 || n > 65535)) return null;
  return { name: match[1], address: `${zone}:${net}/${node}${point ? "." + point : ""}`,
    zone, net, node, point };
}
export interface FtnNodeMatch {
  readonly address: string;
  readonly label: string;
}
/** An unresolved node must not block a syntactically valid NetMail address. */
export function netmailRecipientStatus(input: string, matchedNode: FtnNodeMatch | null):
  { valid: false; error: string } | { valid: true; recipient: FtnRecipient; node: FtnNodeMatch | null; warning: string | null } {
  const recipient = parseFtnRecipient(input);
  if (!recipient) return { valid: false, error: "Enter a name and FTN address (e.g. bamageek@68:1/0)" };
  const node = matchedNode?.address === recipient.address ? matchedNode : null;
  return { valid: true, recipient, node, warning: node ? null : "Node not found in the local nodelist; sending is still permitted." };
}
