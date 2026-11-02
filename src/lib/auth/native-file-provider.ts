import "server-only";
import path from "node:path";
import { verifyMysticHandle } from "../mystic/native-user-login";
import { readNativeAccountSnapshot } from "../mystic/native-account-status";
import type { NativeProvider, NativeRequest } from "./native";

/**
 * Staged local-file adapter for the existing NativeAccess protocol.
 * This is deliberately NOT a production-ready provider.
 *
 * Mystic 1.12 A48 has no separate account-expiration feature in this
 * installation (operator-confirmed 2026-11-01). Eligibility still requires
 * a fresh native status check and rejection of locked, deleted, or
 * forced-password-change accounts. Unknown account states must not be granted.
 *
 * This is staged, not production-wired: message-area authorization is denied
 * unconditionally, and productionAccess() remains disabled.
 */
function eligible(snapshot: Awaited<ReturnType<typeof readNativeAccountSnapshot>>) {
  return snapshot !== null && !snapshot.locked && !snapshot.deletedCandidate &&
    !snapshot.passwordChangeRequired;
}

export class NativeFileProvider implements NativeProvider {
  constructor(private readonly usersDatPath: string, private readonly instance: string) {
    if (!path.isAbsolute(usersDatPath) ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(instance)) throw new Error("Invalid native configuration");
  }

  async request(request: NativeRequest, options: { signal: AbortSignal }): Promise<unknown> {
    if (options.signal.aborted || request.instance !== this.instance) return null;
    if (request.operation === "account") {
      const snapshot = await readNativeAccountSnapshot(this.usersDatPath, request.userId);
      if (options.signal.aborted || !eligible(snapshot)) return null;
      return {
        version: 1, nonce: request.nonce, operation: "account",
        instance: this.instance, userId: snapshot.userId,
        account: {
          exists: true, deleted: snapshot.deletedCandidate,
          locked: snapshot.locked, expired: false,
          passwordChangeRequired: snapshot.passwordChangeRequired,
        },
      };
    }
    if (request.operation !== "authenticate") return null;
    // Recheck account state independently after password verification. The
    // account protocol must not grant sessions based on a password match alone.
    const match = await verifyMysticHandle(this.usersDatPath, request.username, request.password);
    if (options.signal.aborted || !match) return null;
    const snapshot = await readNativeAccountSnapshot(this.usersDatPath, match.userId);
    if (options.signal.aborted || !eligible(snapshot)) return null;
    return {
      version: 1,
      nonce: request.nonce,
      operation: "authenticate",
      instance: this.instance,
      userId: match.userId,
      passwordVerified: true,
      account: {
        exists: true,
        deleted: false,
        locked: false,
        expired: false, // No separate expiration feature in verified A48 installation.
        passwordChangeRequired: false,
      },
    };
  }
}
