import "server-only";
import { randomBytes } from "node:crypto";
import type { Identity } from "./store";

type NativeOperation = (
  | { operation: "authenticate"; username: string; password: string }
  | { operation: "account"; userId: number }
  | { operation: "authorize"; userId: number; areaId: number; catalogRevision: string }
);
export type NativeRequest = { version: 1; nonce: string; instance: string } & NativeOperation;

/** Implement only after native behavior is verified. The production transport
 * must authenticate both peers, bound input/output, never log/persist passwords,
 * and honor cancellation. SSH transport acceptance alone is not BBS identity.
 * There is intentionally no environment-enabled or permissive default provider.
 */
export interface NativeProvider {
  request(request: NativeRequest, options: { signal: AbortSignal }): Promise<unknown>;
}

export class NativeAccessError extends Error {
  constructor() { super("Account or message access unavailable"); }
}

type ObjectValue = Record<string, unknown>;
function object(value: unknown): value is ObjectValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: ObjectValue, expected: string[]) {
  return Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}
function userId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 0x7fffffff;
}
function identityValid(value: Identity, instance: string) {
  return value?.instance === instance && userId(value.userId);
}
function active(value: unknown) {
  return object(value) && keys(value, ["exists", "deleted", "locked", "expired", "passwordChangeRequired"]) &&
    value.exists === true && value.deleted === false && value.locked === false &&
    value.expired === false && value.passwordChangeRequired === false;
}

/** This is a deny-by-default protocol boundary, not a native implementation.
 * The staged HTTP service consumes this boundary, but production composition
 * remains disabled until a native provider has passed runtime checks.
 */
export class NativeAccess {
  constructor(private readonly provider: NativeProvider | null, private readonly instance: string,
    private readonly timeoutMs = 1500) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(instance) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new NativeAccessError();
  }

  private async request(data: NativeOperation): Promise<ObjectValue | null> {
    if (!this.provider) return null;
    const controller = new AbortController();
    const start = performance.now();
    const nonce = randomBytes(32).toString("base64url");
    const request: NativeRequest = { ...data, version: 1, instance: this.instance, nonce };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const expired = new Promise<null>(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(null); }, this.timeoutMs);
      });
      const reply = await Promise.race([this.provider.request(request, { signal: controller.signal }), expired]);
      if (performance.now() - start >= this.timeoutMs || !object(reply)) return null;
      const extra = data.operation === "authenticate" ? ["passwordVerified"] :
        data.operation === "authorize" ? ["areaId", "catalogRevision", "permissions"] : [];
      if (!keys(reply, ["version", "nonce", "operation", "instance", "userId", "account", ...extra]) ||
        reply.version !== 1 || reply.nonce !== nonce || reply.operation !== data.operation ||
        reply.instance !== this.instance || !userId(reply.userId) || !active(reply.account)) return null;
      return reply;
    } catch { return null; }
    finally { if (timer) clearTimeout(timer); controller.abort(); }
  }

  async authenticate(username: string, password: string): Promise<Identity | null> {
    // Preserve exact case/whitespace. Native code must perform its own supported
    // encoding and account-name handling; the web never guesses hash semantics.
    if (typeof username !== "string" || typeof password !== "string" || !username || !password ||
      Buffer.byteLength(username) > 120 || Buffer.byteLength(password) > 256 ||
      /[\x00-\x1f\x7f]/.test(username + password)) return null;
    const reply = await this.request({ operation: "authenticate", username, password });
    if (!reply || reply.passwordVerified !== true) return null;
    return { instance: this.instance, userId: reply.userId as number };
  }

  async accountValid(identity: Identity): Promise<boolean> {
    if (!identityValid(identity, this.instance)) return false;
    const reply = await this.request({ operation: "account", userId: identity.userId });
    return reply?.userId === identity.userId;
  }

  async readArea<T>(identity: Identity, areaId: number, catalogRevision: string, read: () => Promise<T>): Promise<T> {
    if (!identityValid(identity, this.instance) || !Number.isSafeInteger(areaId) || areaId < 1 || areaId > 65535 ||
      !/^[a-f0-9]{64}$/.test(catalogRevision)) throw new NativeAccessError();
    const reply = await this.request({ operation: "authorize", userId: identity.userId, areaId, catalogRevision });
    if (!reply || reply.userId !== identity.userId || reply.areaId !== areaId || reply.catalogRevision !== catalogRevision ||
      !object(reply.permissions) || !keys(reply.permissions, ["list", "read", "group", "context", "kind", "private", "personal"]) ||
      reply.permissions.list !== true || reply.permissions.read !== true || reply.permissions.group !== true ||
      reply.permissions.context !== true || reply.permissions.kind !== "echo" ||
      reply.permissions.private !== false || reply.permissions.personal !== false) throw new NativeAccessError();
    try { return await read(); }
    catch { throw new NativeAccessError(); }
  }
}
