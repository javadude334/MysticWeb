import "server-only";
import type { Identity } from "../auth/store";
import type { AcceptedPost, MessageDraft, NativeMessagePoster } from "./poster";

/**
 * Test-only model of the native writer contract. No file handles, JAM encoding,
 * native account lookup or production activation. Use to test ordering and
 * authorization assumptions before implementing a verified Mystic driver.
 */
export class DisposablePostModel implements NativeMessagePoster {
  private readonly messages = new Map<number, { areaId: number; authorId: number; replyTo: number | null }>();
  private nextNumber = 1;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly authorize: (identity: Readonly<Identity>, draft: MessageDraft) => Promise<boolean>,
    private readonly revision: string,
    private readonly areaId: number,
  ) {}

  post(identity: Readonly<Identity>, draft: MessageDraft, signal: AbortSignal): Promise<AcceptedPost> {
    const operation = this.queue.then(async () => {
      if (signal.aborted || identity.userId < 1 || draft.areaId !== this.areaId ||
          draft.catalogRevision !== this.revision) throw new Error("Unavailable");
      // Check authorization inside the serialized operation, not at queue entry.
      if (!(await this.authorize(identity, draft)) || signal.aborted) throw new Error("Unavailable");
      const parent = draft.replyTo === undefined ? null : this.messages.get(draft.replyTo);
      if (draft.replyTo !== undefined && (!parent || parent.areaId !== draft.areaId))
        throw new Error("Unavailable");
      if (signal.aborted) throw new Error("Unavailable");
      const number = this.nextNumber++;
      this.messages.set(number, { areaId: draft.areaId, authorId: identity.userId, replyTo: draft.replyTo ?? null });
      return { areaId: draft.areaId, messageNumber: number, replyTo: draft.replyTo ?? null };
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  /** Inspection is only for assertions against this in-memory test fixture. */
  snapshot(): ReadonlyArray<{ number: number; areaId: number; authorId: number; replyTo: number | null }> {
    return [...this.messages].map(([number, value]) => ({ number, ...value }));
  }
}
