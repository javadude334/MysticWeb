/**
 * Fail-closed evaluator for the observed A48 G/S subset.
 *
 * This module does NOT infer group membership from an area's G token or from
 * a user's security level. The caller must supply independently verified
 * native group membership and area metadata. Until those decoders are
 * certified, the file provider continues to deny authorization.
 */
import { inspectAreaAcs } from "./acs-candidate";

export interface VerifiedAcsContext {
  securityLevel: number;
  /** Independently decoded native membership; never inferred from area ACS. */
  memberGroupIds: readonly number[];
  /** Independently decoded area flags/type. */
  echoArea: boolean;
  areaVisible: boolean;
  groupVisible: boolean;
  /** Area cannot be a personal/private/netmail context. */
  privateOrPersonal: boolean;
}

export function evaluateVerifiedReadAcs(
  listAcs: string,
  readAcs: string,
  context: VerifiedAcsContext,
): { allowed: boolean; groupId: number | null } {
  const denied = { allowed: false, groupId: null };
  if (!context || !Number.isSafeInteger(context.securityLevel) ||
      context.securityLevel < 0 || context.securityLevel > 255 ||
      !Array.isArray(context.memberGroupIds) ||
      context.memberGroupIds.length > 128 ||
      !context.memberGroupIds.every(id => Number.isSafeInteger(id) && id > 0 && id <= 65535) ||
      context.echoArea !== true || context.areaVisible !== true ||
      context.groupVisible !== true || context.privateOrPersonal !== false) return denied;
  const acs = inspectAreaAcs(listAcs, readAcs);
  if (!acs.supported || context.securityLevel < acs.minimumSecurity ||
      !context.memberGroupIds.includes(acs.groupId)) return denied;
  return { allowed: true, groupId: acs.groupId };
}
