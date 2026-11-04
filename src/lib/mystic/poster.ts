import "server-only";
import type { Identity } from "../auth/store";
import { NativeAccessError } from "../auth/native";

/**
 * A write is deliberately a native operation, never a direct append to JAM
 * files. Mystic owns locking, index updates, reply linkage, and network export.
 * This boundary does not activate posting on the public deployment.
 */
export type MessageDraft = Readonly<{
  areaId: number;
  catalogRevision: string;
  recipient: string;
  subject: string;
  body: string;
  replyTo?: number;
}>;

export type AcceptedPost = Readonly<{
  areaId: number;
  messageNumber: number;
  replyTo: number | null;
}>;

export interface NativeMessagePoster {
  /** Must independently revalidate caller, area revision and write/post ACS.
   * Must confirm parent is visible in the same area before linking a reply.
   * Must write atomically through Mystic-compatible locking and encoding.
   * Must return only after the message is durably accepted.
   */
  post(identity: Readonly<Identity>, draft: MessageDraft, signal: AbortSignal): Promise<AcceptedPost>;
}

function cleanText(value: unknown, maximumBytes: number, allowNewlines: boolean): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    Buffer.byteLength(value, "utf8") <= maximumBytes &&
    !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value) &&
    (allowNewlines ? !/\r(?!\n)/.test(value) : !/[\r\n]/.test(value));
}

/** Validate untrusted input without normalizing or changing the message body. */
export function validateMessageDraft(value: unknown): MessageDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new NativeAccessError();
  const data = value as Record<string, unknown>;
  const names = Object.keys(data).sort();
  const expected = ["areaId", "body", "catalogRevision", "recipient", "subject", ...(data.replyTo === undefined ? [] : ["replyTo"])].sort();
  if (names.join(",") !== expected.join(",") ||
    !Number.isInteger(data.areaId) || (data.areaId as number) < 1 || (data.areaId as number) > 65535 ||
    typeof data.catalogRevision !== "string" || !/^[a-f0-9]{64}$/.test(data.catalogRevision) ||
    !cleanText(data.recipient, 120, false) ||
    !cleanText(data.subject, 240, false) ||
    !cleanText(data.body, 65536, true) ||
    (data.replyTo !== undefined && (!Number.isSafeInteger(data.replyTo) || (data.replyTo as number) < 1 || (data.replyTo as number) > 0xffffffff))) {
    throw new NativeAccessError();
  }
  return data as MessageDraft;
}

/** Posting is unavailable until a verified native writer is explicitly injected.
 * An absent driver, timeout, or malformed receipt always fails closed.
 */
export class MessagePoster {
  constructor(private readonly native: NativeMessagePoster | null, private readonly instance: string) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(instance)) throw new NativeAccessError();
  }

  async post(identity: Readonly<Identity>, input: unknown): Promise<AcceptedPost> {
    const draft = validateMessageDraft(input);
    if (!this.native || identity.instance !== this.instance ||
      !Number.isSafeInteger(identity.userId) || identity.userId < 1) throw new NativeAccessError();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const result = await this.native.post(identity, draft, controller.signal);
      if (controller.signal.aborted || !result ||
        result.areaId !== draft.areaId ||
        !Number.isSafeInteger(result.messageNumber) || result.messageNumber < 1 || result.messageNumber > 0xffffffff ||
        result.replyTo !== (draft.replyTo ?? null)) throw new NativeAccessError();
      return result;
    } catch { throw new NativeAccessError(); }
    finally { clearTimeout(timer); controller.abort(); }
  }
}
