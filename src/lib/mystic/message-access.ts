import "server-only";
import { candidateMeetsSecurityLevel } from "./acs-candidate";
import { isJamBaseName } from "./jam";
import type { MysticArea, MysticGroup } from "./config";

/** Sandbox-only catalog authorization. Native group List ACS and area kind
 * must be decoded before this can be used as production authorization.
 * No client-supplied security level or group list is trusted.
 */
export class MessageAccess {
  private readonly groups: MysticGroup[];
  private readonly areas: MysticArea[];
  constructor(groups: readonly MysticGroup[], areas: readonly MysticArea[], private readonly securityLevel: number) {
    if (!Number.isInteger(securityLevel) || securityLevel < 0 || securityLevel > 255)
      throw new Error("Invalid account security");
    this.groups = groups.filter(g => !/(?:^|[\s_-])netmail(?:$|[\s_-])/i.test(g.name));
    const ids = new Set(this.groups.map(g => g.id));
    this.areas = areas.filter(a => a.inferredGroupId !== null && ids.has(a.inferredGroupId) &&
      !/(?:^|[\s_-])netmail(?:$|[\s_-])/i.test(a.name) && isJamBaseName(a.jamBase) &&
      candidateMeetsSecurityLevel(a.security[0], a.security[1], securityLevel).groupId === a.inferredGroupId);
  }
  getGroups(): MysticGroup[] {
    return this.groups.filter(g => this.areas.some(a => a.inferredGroupId === g.id));
  }
  getMessageAreas(groupId: number): MysticArea[] {
    if (!this.getGroups().some(g => g.id === groupId)) return [];
    return this.areas.filter(a => a.inferredGroupId === groupId);
  }
  getArea(areaId: number): MysticArea | undefined {
    if (!Number.isSafeInteger(areaId)) return undefined;
    return this.areas.find(a => a.id === areaId);
  }
  getSearchAreas(groupName: string, allGroups: boolean) {
    const groups = this.getGroups().filter(g => allGroups || g.name === groupName);
    return groups.flatMap(g => this.getMessageAreas(g.id).map(a => ({
      id: a.id, name: a.name, groupId: g.id, groupName: g.name, jamBase: a.jamBase,
    })));
  }
}
