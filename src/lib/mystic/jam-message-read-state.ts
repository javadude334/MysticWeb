import { findJamLastRead, parseJamLastRead } from "./jam-last-read";

/** A read-only, per-user JAM pointer snapshot. No native files are changed. */
export interface JamMessageReadState {
  readonly lastReadMsg: number;
  readonly highReadMsg: number;
}

/** Missing or ambiguous user state is unknown, never implicitly read/unread. */
export function getJamMessageReadState(lastReadFile: Buffer, userId: number): JamMessageReadState | null {
  const record = findJamLastRead(parseJamLastRead(lastReadFile), userId);
  if (!record) return null;
  if (record.highReadMsg < record.lastReadMsg) return null;
  return { lastReadMsg: record.lastReadMsg, highReadMsg: record.highReadMsg };
}

/** The read pointer is a threshold, not a per-message read receipt.
 * "new" means after last-read; it does not imply the user never viewed it.
 */
export function classifyJamMessage(
  state: JamMessageReadState | null, messageNumber: number,
): "after-pointer" | "at-or-before-pointer" | "unknown" {
  if (!state || !Number.isSafeInteger(messageNumber) || messageNumber < 1 ||
      messageNumber > 0xffffffff) return "unknown";
  return messageNumber > state.lastReadMsg ? "after-pointer" : "at-or-before-pointer";
}
