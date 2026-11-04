import "server-only";
import type { Identity } from "./store";
import { AuthStore } from "./store";
import { NativeAccess, NativeAccessError } from "./native";

/**
 * Single entry point for application security. Native Mystic is the source of
 * truth; a web session proves identity only, never resource permission.
 *
 * All resource actions are denied unless an explicitly verified native
 * authorization adapter is available. Never infer permission from security
 * level, an ACS string, a URL, or the existence of a data file.
 */
export type SecurityResource =
  | { resource: "message-area"; resourceId: number; action: "list" | "read" | "post" | "sysop"; catalogRevision: string }
  | { resource: "file-area"; resourceId: number; action: "list" | "download" | "upload"; catalogRevision: string }
  | { resource: "bulletin"; resourceId: number; action: "read"; catalogRevision: string }
  | { resource: "private-mail"; resourceId: number; action: "read" | "send"; catalogRevision: string }
  | { resource: "profile"; resourceId: number; action: "read" | "edit"; catalogRevision: string }
  | { resource: "administration"; action: "access"; catalogRevision: string };

export class ApplicationSecurity {
  constructor(
    private readonly native: NativeAccess,
    private readonly sessionDbPath: string,
  ) {}

  authenticate(username: string, password: string): Promise<Identity | null> {
    return this.native.authenticate(username, password);
  }

  /** Validate the session AND recheck the live native account on each request. */
  async validateSession(token: string | undefined): Promise<Identity | null> {
    const store = new AuthStore(this.sessionDbPath);
    let identity: Identity | null;
    try { identity = store.read(token); }
    finally { store.close(); }
    if (!identity) return null;
    if (!(await this.native.accountValid(identity))) return null;
    return identity;
  }

  /** Called only after native password verification; rotates an old token. */
  async createSession(identity: Identity, oldToken?: string): Promise<string> {
    if (!(await this.native.accountValid(identity))) throw new NativeAccessError();
    const store = new AuthStore(this.sessionDbPath);
    try { return store.create(identity, oldToken); }
    finally { store.close(); }
  }

  revokeSession(token: string | undefined): void {
    const store = new AuthStore(this.sessionDbPath);
    try { store.revoke(token); }
    finally { store.close(); }
  }

  /**
   * No permissive default. This method intentionally denies unsupported
   * operations until their native resource-specific checks are implemented.
   * Read message bodies via readMessageArea(), which keeps the native
   * authorization check and the protected read in one operation.
   */
  async authorize(identity: Identity, target: SecurityResource): Promise<boolean> {
    if (!identity || !(await this.native.accountValid(identity))) return false;
    // The existing native protocol has only an echo-area read authorization
    // response, and it cannot safely authorize other resources or operations.
    void target;
    return false;
  }

  async readMessageArea<T>(
    identity: Identity,
    areaId: number,
    catalogRevision: string,
    read: () => Promise<T>,
  ): Promise<T> {
    if (!(await this.native.accountValid(identity))) throw new NativeAccessError();
    return this.native.readArea(identity, areaId, catalogRevision, read);
  }
}
