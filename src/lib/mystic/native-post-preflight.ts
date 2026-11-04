/** Pure, fail-closed validation for native Mystic echo-area post/reply requests.
 * Caller must independently authenticate the account, resolve the area from
 * trusted native configuration and check current List/Read/Post ACS.
 * This module never writes a JAM file or accepts filesystem paths.
 */
export interface MysticPostDraft {
  subject: string;
  recipient: string;
  body: string;
  replyTo?: number;
}
export interface MysticPostContext {
  userId: number;
  areaId: number;
  canPost: boolean;
  isPublicEcho: boolean;
}
export interface ValidatedMysticPost {
  userId: number;
  areaId: number;
  subject: string;
  recipient: string;
  body: string;
  replyTo: number | null;
}
const clean = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max &&
  value.trim().length > 0 &&
  !/[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value);

export function validateMysticPost(
  context: MysticPostContext, draft: MysticPostDraft,
): ValidatedMysticPost {
  if (!context || !Number.isSafeInteger(context.userId) || context.userId < 1 ||
      context.userId > 0xffffffff || !Number.isSafeInteger(context.areaId) ||
      context.areaId < 1 || context.areaId > 65535 ||
      context.canPost !== true || context.isPublicEcho !== true)
    throw new Error("Posting is not authorized");
  if (!draft || !clean(draft.subject, 120) || !clean(draft.recipient, 80) ||
      !clean(draft.body, 65536) || draft.body.includes("\u0000"))
    throw new Error("Invalid message draft");
  const replyTo = draft.replyTo === undefined ? null : draft.replyTo;
  if (replyTo !== null && (!Number.isSafeInteger(replyTo) || replyTo < 1 || replyTo > 0xffffffff))
    throw new Error("Invalid reply reference");
  return { userId: context.userId, areaId: context.areaId,
    subject: draft.subject.trim(), recipient: draft.recipient.trim(),
    body: draft.body.replace(/\r\n?/g, "\n"), replyTo };
}

/** Reply parent must have been retrieved through authorized area read,
 * not merely supplied by a browser or inferred from an index offset.
 */
export function validateMysticReplyParent(
  post: ValidatedMysticPost, parent: { number: number; areaId: number } | null,
): void {
  if (post.replyTo === null) return;
  if (!parent || parent.areaId !== post.areaId || parent.number !== post.replyTo)
    throw new Error("Reply parent unavailable in authorized area");
}
