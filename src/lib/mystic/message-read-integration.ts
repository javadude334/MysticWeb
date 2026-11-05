import "server-only";
import { recordUserMessageRead } from "./message-receipt-writer";
import type { UserMessageReceipt } from "./message-sidecar";

/**
 * Authorized boundary between the native JAM reader and supplemental read receipts.
 * The browser must never supply instance/user/area identity or the stable sidecar ID.
 * No native JAM/JLR files are modified.
 */
export async function recordVerifiedMessageOpen(
  context: {
    metadataRoot: string;
    instanceId: string;
    userId: number;
    areaId: number;
    jamNumber: number;
  },
  dependencies: {
    /** Revalidate current account and List/Read ACS on every invocation. */
    authorize: () => Promise<boolean>;
    /** Resolve only an existing, verified stable sidecar mapping for this JAM message. */
    resolveStableId: () => Promise<string | null>;
  },
): Promise<UserMessageReceipt | null> {
  if (!Number.isSafeInteger(context.jamNumber) || context.jamNumber < 1 ||
      context.jamNumber > 0xffffffff) throw new RangeError("Invalid JAM message number");
  if (!await dependencies.authorize()) return null;
  const stableId = await dependencies.resolveStableId();
  if (!stableId) return null; // No invented mapping, no implicit read.
  return recordUserMessageRead(
    context.metadataRoot, context.instanceId, context.areaId,
    context.userId, stableId,
  );
}
