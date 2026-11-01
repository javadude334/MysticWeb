import "server-only";
import path from "node:path";
import { verifyMysticHandle } from "../mystic/native-user-login";
import { readNativeAccountSnapshot } from "../mystic/native-account-status";
import type { NativeProvider, NativeRequest } from "./native";

/**
 * Staged local-file adapter for the existing NativeAccess protocol.
 * This is deliberately NOT a production-ready provider.
 *
 * Password verification is established, but Mystic 1.12 A48 expiration
 * semantics are not. No account can receive a session until an independent
 * native account-policy evaluator is implemented and reviewed.
 *
 * The provider also denies message-area authorization unconditionally.
 */
export class NativeFileProvider implements NativeProvider {
  constructor(private readonly usersDatPath: string, private readonly instance: string) {
    if (!path.isAbsolute(usersDatPath) ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(instance)) throw new Error("Invalid native configuration");
  }

  async request(request: NativeRequest, options: { signal: AbortSignal }): Promise<unknown> {
    if (options.signal.aborted || request.instance !== this.instance) return null;
    if (request.operation === "account") {
      const snapshot = await readNativeAccountSnapshot(this.usersDatPath, request.userId);
      if (options.signal.aborted || !snapshot) return null;
      return {
        version: 1, nonce: request.nonce, operation: "account",
        instance: this.instance, userId: snapshot.userId,
        account: {
          exists: true, deleted: snapshot.deletedCandidate,
          locked: snapshot.locked, expired: true,
          passwordChangeRequired: snapshot.passwordChangeRequired,
        },
      };
    }
    if (request.operation !== "authenticate") return null;
    // This establishes the password/handle boundary, but cannot assert that
    // the account is non-expired. Never emit an 'active' account response.
    const match = await verifyMysticHandle(this.usersDatPath, request.username, request.password);
    if (options.signal.aborted || !match) return null;
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
        expired: true, // Fail closed until A48 expiration semantics are verified.
        passwordChangeRequired: false,
      },
    };
  }
}
