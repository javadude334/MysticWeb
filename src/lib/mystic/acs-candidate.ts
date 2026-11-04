/**
 * Conservative parser for the observed Mystic A48 concatenated G/S ACS subset.
 *
 * IMPORTANT: this is a lexical candidate evaluator, NOT an authorization
 * decision. Group visibility, user flags, area kind, and Mystic's native ACS
 * semantics must be independently verified before this can gate JAM reads.
 */
export type AcsCandidate =
  | { supported: true; groupId: number; minimumSecurity: number }
  | { supported: false; reason: "empty" | "unsupported" | "ambiguous" };

export function parseAcsCandidate(expression: string): AcsCandidate {
  if (typeof expression !== "string" || expression.length > 30)
    return { supported: false, reason: "unsupported" };
  const input = expression.trim();
  if (!input) return { supported: false, reason: "empty" };
  // Deliberately reject operators, negation, OR, wildcard, account flags,
  // multiple group operands and any unknown Mystic expression.
  if (!/^(?:[gGsS][0-9]+)+$/.test(input))
    return { supported: false, reason: "unsupported" };
  const terms = [...input.matchAll(/([gGsS])([0-9]+)/g)];
  const groups = terms.filter(m => m[1].toLowerCase() === "g");
  const security = terms.filter(m => m[1].toLowerCase() === "s");
  if (groups.length !== 1 || security.length > 1)
    return { supported: false, reason: "ambiguous" };
  const groupId = Number(groups[0][2]);
  const minimumSecurity = security.length ? Number(security[0][2]) : 0;
  if (!Number.isSafeInteger(groupId) || groupId < 1 || groupId > 65535 ||
      !Number.isSafeInteger(minimumSecurity) || minimumSecurity > 255)
    return { supported: false, reason: "unsupported" };
  return { supported: true, groupId, minimumSecurity };
}

export function inspectAreaAcs(list: string, read: string): AcsCandidate {
  const a = parseAcsCandidate(list);
  const b = parseAcsCandidate(read);
  if (!a.supported) return a;
  if (!b.supported) return b;
  if (a.groupId !== b.groupId)
    return { supported: false, reason: "ambiguous" };
  return { supported: true, groupId: a.groupId,
    minimumSecurity: Math.max(a.minimumSecurity, b.minimumSecurity) };
}

/**
 * Diagnostic-only comparison against a known security-level snapshot.
 * This does not check group Access/Hidden, account flags, message-base type,
 * or full native ACS semantics and MUST NOT authorize storage access.
 */
export function candidateMeetsSecurityLevel(
  list: string, read: string, securityLevel: number,
): { candidate: boolean; groupId: number | null } {
  if (!Number.isSafeInteger(securityLevel) || securityLevel < 0 || securityLevel > 255)
    return { candidate: false, groupId: null };
  const parsed = inspectAreaAcs(list, read);
  if (!parsed.supported || securityLevel < parsed.minimumSecurity)
    return { candidate: false, groupId: null };
  return { candidate: true, groupId: parsed.groupId };
}
