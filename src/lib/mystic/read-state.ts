import "server-only";

/**
 * Read state is scoped to one Mystic account and one message area.
 * Implementations MUST use Mystic's verified native pointer format.
 * Do not substitute JAM's shared MSG_READ header bit or an app-only
 * sidecar: either would disagree with the terminal BBS.
 */
export type ReadStateIdentity = Readonly<{
  instance: string;
  userId: number;
}>;

export type ReadStateSnapshot = Readonly<{
  areaId: number;
  lastRead: number;
  highMessage: number;
}>;

export interface MysticReadStateWriter {
  /** Must authenticate and authorize the user/area before invoking this. */
  read(identity: ReadStateIdentity, areaId: number): Promise<ReadStateSnapshot>;
  /** Atomically persist a monotonic, per-user pointer in Mystic's native format. */
  markRead(identity: ReadStateIdentity, areaId: number, messageNumber: number): Promise<ReadStateSnapshot>;
}

/** A write is never allowed until the native adapter has been verified. */
export class NativeReadStateUnavailable extends Error {
  constructor() {
    super("Mystic-compatible read-pointer writes are not configured");
    this.name = "NativeReadStateUnavailable";
  }
}

/**
 * Production fail-closed placeholder. A native implementation must be
 * installed explicitly after binary analysis and two-way sandbox testing.
 */
export class UnconfiguredMysticReadStateWriter implements MysticReadStateWriter {
  async read(): Promise<never> {
    throw new NativeReadStateUnavailable();
  }
  async markRead(): Promise<never> {
    throw new NativeReadStateUnavailable();
  }
}

/**
 * Validates all user-controlled identifiers before a native write.
 * Does not imply authorization: caller must re-check session and ACS.
 */
export function validateReadWrite(identity: ReadStateIdentity, areaId: number, messageNumber: number): void {
  if (!identity || typeof identity.instance !== "string" || !identity.instance ||
      !Number.isSafeInteger(identity.userId) || identity.userId <= 0 ||
      !Number.isSafeInteger(areaId) || areaId <= 0 || areaId > 65535 ||
      !Number.isSafeInteger(messageNumber) || messageNumber <= 0 || messageNumber > 0xffffffff) {
    throw new RangeError("Invalid Mystic read-state identity or message number");
  }
}

/** No rewind: native pointers are monotonically increasing for each user/area. */
export function monotonicReadPointer(previous: number, messageNumber: number): number {
  if (!Number.isSafeInteger(previous) || previous < 0 || previous > 0xffffffff ||
      !Number.isSafeInteger(messageNumber) || messageNumber <= 0 || messageNumber > 0xffffffff)
    throw new RangeError("Invalid read pointer");
  return Math.max(previous, messageNumber);
}
