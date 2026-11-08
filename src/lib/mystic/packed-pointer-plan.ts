/**
 * Pure, offline post-pack pointer planner. No file I/O and no live writes.
 * A caller must supply complete, verified before/after message snapshots.
 * Never infer identity from JAM number, which may change during packing.
 */
export interface PointerMessage {
  readonly number: number;
  /** Immutable verified identity, independent of JAM number. */
  readonly identity: string;
}
export interface PointerPlan {
  readonly status: "safe_candidate" | "blocked";
  readonly reason: string;
  readonly previous: number;
  readonly proposed: number | null;
}

function validSnapshot(messages: readonly PointerMessage[]): boolean {
  if (messages.length > 100000) return false;
  const identities = new Set<string>();
  let previous = 0;
  for (const item of messages) {
    if (!Number.isSafeInteger(item.number) || item.number <= previous ||
        item.number > 0xffffffff || !/^[a-f0-9]{64}$/.test(item.identity) ||
        identities.has(item.identity)) return false;
    previous = item.number;
    identities.add(item.identity);
  }
  return true;
}

/**
 * Plan a pointer threshold only when all surviving messages retain their
 * original read/unread classification, and the after-pack sequence has a
 * single contiguous read prefix. Missing/deleted messages cannot be used
 * to manufacture new read receipts.
 *
 * A safe candidate is NOT authorization to write .jlr: native locks, user
 * mapping and Mystic-specific pointer semantics still require validation.
 */
export function planPackedPointer(
  before: readonly PointerMessage[], after: readonly PointerMessage[],
  previous: number,
): PointerPlan {
  const blocked = (reason: string): PointerPlan =>
    ({ status: "blocked", reason, previous, proposed: null });
  if (!Number.isSafeInteger(previous) || previous < 0 || previous > 0xffffffff ||
      !validSnapshot(before) || !validSnapshot(after) || !before.length)
    return blocked("invalid_or_incomplete_snapshot");
  const old = new Map(before.map(m => [m.identity, m.number]));
  const surviving = new Set<string>();
  let lastRead = 0;
  let sawUnread = false;
  for (const message of after) {
    const oldNumber = old.get(message.identity);
    if (oldNumber === undefined) return blocked("new_or_unverified_identity");
    surviving.add(message.identity);
    const wasRead = oldNumber <= previous;
    if (wasRead && sawUnread) return blocked("noncontiguous_read_state");
    if (wasRead) lastRead = message.number;
    else sawUnread = true;
  }
  // A message missing from the after snapshot could be deleted or merely
  // omitted by a truncated scan. Require the caller to establish completeness.
  // This planner cannot distinguish the two and does not approve deletions.
  if (surviving.size !== old.size) return blocked("missing_identity_requires_deletion_proof");
  return { status: "safe_candidate", reason: "identity_preserved", previous, proposed: lastRead };
}
