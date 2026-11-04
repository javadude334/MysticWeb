import "server-only";
import { parseAcsCandidate } from "./acs-candidate";
import { isJamBaseName } from "./jam";
import type { MysticArea, MysticGroup } from "./config";

/** Verified simple native group ACS subset: blank (unrestricted) or sNN.
 * Unknown expressions are denied rather than guessed.
 */
export function groupAccessAllowed(expression: string, securityLevel: number): boolean {
  if (!Number.isInteger(securityLevel) || securityLevel < 0 || securityLevel > 255) return false;
  if (expression === "") return true;
  const match = /^s([0-9]{1,3})$/i.exec(expression);
  return !!match && Number(match[1]) <= 255 && securityLevel >= Number(match[1]);
}

/** Only the verified sNNgID / gIDsNN candidate grammar is supported.
 * Each operation is checked independently, including its group binding.
 */
export function areaOperationAllowed(expression: string, groupId: number, securityLevel: number): boolean {
  const parsed = parseAcsCandidate(expression);
  return parsed.supported && parsed.groupId === groupId && securityLevel >= parsed.minimumSecurity;
}

export class MessageAccess {
  private readonly groups: MysticGroup[];
  private readonly listed: MysticArea[];
  private readonly readable: MysticArea[];
  constructor(groups: readonly MysticGroup[], areas: readonly MysticArea[], private readonly securityLevel: number) {
    if (!Number.isInteger(securityLevel) || securityLevel < 0 || securityLevel > 255)
      throw new Error("Invalid account security");
    this.groups = groups.filter(g =>
      groupAccessAllowed(g.access, securityLevel) &&
      !/(?:^|[\s_-])netmail(?:$|[\s_-])/i.test(g.name));
    const ids = new Set(this.groups.map(g => g.id));
    this.listed = areas.filter(a => a.inferredGroupId !== null && ids.has(a.inferredGroupId) &&
      !/(?:^|[\s_-])netmail(?:$|[\s_-])/i.test(a.name) && isJamBaseName(a.jamBase) &&
      areaOperationAllowed(a.security[0], a.inferredGroupId, securityLevel));
    this.readable = this.listed.filter(a =>
      areaOperationAllowed(a.security[1], a.inferredGroupId as number, securityLevel));
  }
  getGroups(): MysticGroup[] {
    return this.groups;
  }
  getMessageAreas(groupId: number): MysticArea[] {
    if (!this.groups.some(g => g.id === groupId)) return [];
    return this.listed.filter(a => a.inferredGroupId === groupId);
  }
  canRead(areaId: number): boolean {
    return this.readable.some(a => a.id === areaId);
  }
  canPost(areaId: number): boolean {
    const area = this.readable.find(a => a.id === areaId);
    return !!area && area.inferredGroupId !== null &&
      areaOperationAllowed(area.security[2], area.inferredGroupId, this.securityLevel);
  }
  getArea(areaId: number): MysticArea | undefined {
    if (!Number.isSafeInteger(areaId)) return undefined;
    return this.readable.find(a => a.id === areaId);
  }
  getSearchAreas(groupName: string, allGroups: boolean) {
    const groups = this.getGroups().filter(g => allGroups || g.name === groupName);
    return groups.flatMap(g => this.readable.filter(a => a.inferredGroupId === g.id).map(a => ({
      id: a.id, name: a.name, groupId: g.id, groupName: g.name, jamBase: a.jamBase,
    })));
  }
}
