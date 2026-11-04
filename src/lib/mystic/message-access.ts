import "server-only";
import { candidateMeetsSecurityLevel } from "./acs-candidate";
import { isJamBaseName } from "./jam";
import type { MysticArea, MysticGroup } from "./config";

/** Sandbox-only catalog authorization. Native group List ACS and area kind
 * must be decoded before this can be used as production authorization.
 * No client-supplied security level or group list is trusted.
 */
/** Temporary sandbox gate until native group List ACS offsets are verified.
 * Each group must have an operator-declared minimum security level. Missing,
 * malformed, or duplicate rules deny access; no group name is trusted.
 * This is an additional restriction, never a replacement for native ACS.
 */
export function sandboxGroupThresholds(value: string | undefined): ReadonlyMap<number, number> {
  const rules = new Map<number, number>();
  if (!value) return rules;
  for (const part of value.split(",")) {
    const match = /^([1-9][0-9]{0,4}):([0-9]{1,3})$/.exec(part.trim());
    if (!match) throw new Error("Invalid sandbox group security policy");
    const id = Number(match[1]), level = Number(match[2]);
    if (id > 65535 || level > 255 || rules.has(id)) throw new Error("Invalid sandbox group security policy");
    rules.set(id, level);
  }
  return rules;
}

export class MessageAccess {
  private readonly groups: MysticGroup[];
  private readonly areas: MysticArea[];
  constructor(groups: readonly MysticGroup[], areas: readonly MysticArea[], private readonly securityLevel: number, groupThresholds: ReadonlyMap<number, number> = new Map()) {
    if (!Number.isInteger(securityLevel) || securityLevel < 0 || securityLevel > 255)
      throw new Error("Invalid account security");
    this.groups = groups.filter(g => {
      const required = groupThresholds.get(g.id);
      return required !== undefined && Number.isInteger(required) && required >= 0 && required <= 255 &&
        securityLevel >= required && !/(?:^|[\s_-])netmail(?:$|[\s_-])/i.test(g.name);
    });
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
