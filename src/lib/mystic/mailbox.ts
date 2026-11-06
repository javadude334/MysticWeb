import "server-only";
import type { JamMessage } from "./jam";

/** Private mail is deliberately isolated from public EchoMail readers.
 * No caller may infer mailbox ownership from an area number alone.
 */
export type MailKind = "local" | "netmail";
export type MailFolder = "inbox" | "sent";
export interface VerifiedMailIdentity {
  readonly userId: number;
  /** Authoritative handle from users.dat, not a browser field. */
  readonly handle: string;
}
export interface MailboxScope {
  readonly kind: MailKind;
  readonly areaId: number;
  readonly jamBase: string;
  /** Only a trusted, server-side configuration can set this. */
  readonly verified: true;
}

/** Normalization for exact native handle comparisons; never substring-match.
 * Unknown character sets and aliases must be resolved by a native adapter.
 */
export function sameNativeHandle(left: string, right: string): boolean {
  return /^[\x21-\x7e]{1,30}$/.test(left) &&
    /^[\x21-\x7e]{1,30}$/.test(right) &&
    left.toLowerCase() === right.toLowerCase();
}

/** The public JAM reader intentionally hides private/NetMail attributes.
 * A future private reader must authorize BEFORE returning message bodies.
 * NetMail routing/recipient ownership must be independently verified.
 */
export function localMailFolder(
  scope: MailboxScope, identity: VerifiedMailIdentity, message: JamMessage,
): MailFolder | null {
  if (scope.verified !== true || scope.kind !== "local" ||
      !Number.isSafeInteger(scope.areaId) || scope.areaId < 1 ||
      !Number.isSafeInteger(identity.userId) || identity.userId < 1 ||
      !/^[\x21-\x7e]{1,30}$/.test(identity.handle) ||
      !Number.isSafeInteger(message.number) || message.number < 1 ||
      (message.attributes & 0x80000004) !== 0) return null; // deleted / no-display
  if (sameNativeHandle(message.recipient, identity.handle)) return "inbox";
  if (sameNativeHandle(message.author, identity.handle)) return "sent";
  return null;
}

/** NetMail addresses are not local user handles. Do not grant NetMail
 * visibility until origin/destination address ownership is verified.
 */
export function netmailVisibleWithoutNativeRoutingProof(): false {
  return false;
}
