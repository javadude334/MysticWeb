/** Shared domain contracts for Mystic groups and areas.
 * These are validated application models, not binary on-disk layouts.
 */
export interface MysticGroupBase {
  readonly id: number;
  readonly name: string;
  readonly access: string;
}

export interface MysticMessageGroup extends MysticGroupBase {
  readonly kind: "message";
}

export interface MysticFileGroup extends MysticGroupBase {
  readonly kind: "file";
}

export interface MysticAreaBase {
  readonly id: number;
  readonly name: string;
  readonly inferredGroupId: number | null;
}

export interface MysticMessageArea extends MysticAreaBase {
  readonly kind: "message";
  readonly jamBase: string;
  /** Native A48 editor order: List, Read, Post, Sysop. */
  readonly security: readonly [string, string, string, string];
}

export interface MysticFileArea extends MysticAreaBase {
  readonly kind: "file";
  readonly storagePath: string;
  /** File-area ACS is deliberately not mapped to message-area operations. */
  readonly access: Readonly<Record<string, string>>;
}

export type MysticArea = MysticMessageArea | MysticFileArea;
