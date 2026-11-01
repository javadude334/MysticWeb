import "server-only";

/**
 * Conservative inventory of observed Mystic A48 message ACS strings.
 * IMPORTANT: parsing an expression is not authorization. Mystic's gN
 * operator and group-level Access ACS must be validated independently.
 * No function in this module grants access.
 */
export type ObservedAcs =
  | { kind: "level-and-group-candidate"; minimumLevel: number; groupId: number }
  | { kind: "level-only-candidate"; minimumLevel: number }
  | { kind: "blank" }
  | { kind: "unsupported" };

export function inspectObservedAcs(value: string): ObservedAcs {
  if (typeof value !== "string" || value.length > 30) return { kind: "unsupported" };
  if (value === "") return { kind: "blank" };
  const pair = /^s(\d{1,3})g(\d{1,10})$/.exec(value);
  if (pair) {
    const minimumLevel = Number(pair[1]), groupId = Number(pair[2]);
    if (minimumLevel <= 255 && groupId > 0 && groupId <= 0xffffffff)
      return { kind: "level-and-group-candidate", minimumLevel, groupId };
  }
  const single = /^s(\d{1,3})$/.exec(value);
  if (single && Number(single[1]) <= 255)
    return { kind: "level-only-candidate", minimumLevel: Number(single[1]) };
  return { kind: "unsupported" };
}

/** A deliberately fail-closed boundary. Until native ACS semantics are
 * validated, even recognized expressions cannot grant a message read.
 */
export function nativeMessageAccessVerified(): false { return false; }
