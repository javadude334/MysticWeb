import "server-only";
import { createHash } from "node:crypto";
import type { Identity } from "../auth/store";
import { NativeAccess, NativeAccessError } from "../auth/native";
import { isJamBaseName, readJam } from "./jam";

export interface CatalogGroup { id: number; name: string }
export interface CatalogArea { groupIds?: readonly number[]; id: number; name: string; jamBase: string; kind: "echo" | "netmail" | "private" | "unknown" }
export interface Catalog { revision: string; groups?: readonly CatalogGroup[]; areas: readonly CatalogArea[] }

/** Hash the exact two trusted config files in this order, with lengths. The BBS
 * driver must independently hash the same snapshot, never echo the request hash.
 */
export function catalogRevision(groups: Buffer, areas: Buffer): string {
  const hash = createHash("sha256").update("MysticWeb/catalog/v1\0");
  for (const data of [groups, areas]) hash.update(`${data.length}:`).update(data);
  return hash.digest("hex");
}

export function numericId(value: string | null, maximum = 0xffffffff): number {
  if (!value || !/^[1-9][0-9]{0,9}$/.test(value)) throw new NativeAccessError();
  const result = Number(value);
  if (value !== String(result) || !Number.isSafeInteger(result) || result > maximum) throw new NativeAccessError();
  return result;
}

export class MessageReader {
  constructor(private readonly native: NativeAccess, private readonly catalog: () => Promise<Catalog>,
    private readonly root: string, private readonly storage = readJam) {}

  private async snapshot() {
    const catalog = await this.catalog();
    if (!/^[a-f0-9]{64}$/.test(catalog.revision) || catalog.areas.length > 512 ||
      new Set(catalog.areas.map(a => a.id)).size !== catalog.areas.length ||
      catalog.areas.some(a => !Number.isInteger(a.id) || a.id < 1 || a.id > 65535 ||
        typeof a.name !== "string" || a.name.length > 60 || !isJamBaseName(a.jamBase) ||
        !["echo", "netmail", "private", "unknown"].includes(a.kind))) throw new NativeAccessError();
    const groups = catalog.groups ?? [];
    if (groups.length > 128 || new Set(groups.map(g => g.id)).size !== groups.length ||
      groups.some(g => !Number.isInteger(g.id) || g.id < 1 || g.id > 65535 ||
        typeof g.name !== "string" || !g.name.trim() || g.name.length > 60) ||
      catalog.areas.some(a => a.groupIds !== undefined && (!Array.isArray(a.groupIds) ||
        a.groupIds.length > 128 || new Set(a.groupIds).size !== a.groupIds.length ||
        a.groupIds.some(id => !Number.isInteger(id) || !groups.some(g => g.id === id)))))
      throw new NativeAccessError();
    return catalog;
  }

  async areas(identity: Identity) {
    const catalog = await this.snapshot();
    const visible: { id: number; name: string; groupIds: readonly number[] }[] = [];
    const deadline = performance.now() + 4000;
    // Sequential and bounded: no unbounded bridge fan-out or shared allow cache.
    for (const area of catalog.areas) {
      // Classification must come from verified native area metadata, never names.
      if (area.kind !== "echo" || !area.groupIds?.length) continue;
      if (performance.now() >= deadline) throw new NativeAccessError();
      try {
        await this.native.readArea(identity, area.id, catalog.revision, async () => {
          visible.push({ id: area.id, name: area.name, groupIds: area.groupIds ?? [] });
        });
      } catch { /* inaccessible areas disclose no metadata */ }
    }
    if (performance.now() >= deadline || (await this.snapshot()).revision !== catalog.revision) throw new NativeAccessError();
    return { groups: (catalog.groups ?? []).filter(g => visible.some(a => a.groupIds.includes(g.id))), areas: visible };
  }

  /** Authorized groups in Mystic configuration order; ungrouped areas are omitted. */
  async listGroups(identity: Identity) {
    return (await this.areas(identity)).groups;
  }

  /** Areas belonging to one group, after independent native read-ACS checks. */
  async listAreasByGroup(identity: Identity, groupId: number) {
    if (!Number.isSafeInteger(groupId) || groupId < 1 || groupId > 65535) throw new NativeAccessError();
    const result = await this.areas(identity);
    if (!result.groups.some(group => group.id === groupId)) throw new NativeAccessError();
    return result.areas.filter(area => area.groupIds.includes(groupId));
  }

  /** A bounded per-area message listing. The native reader owns permissions. */
  async listMessages(identity: Identity, areaId: number, options: { before?: number; limit?: number } = {}) {
    return this.read(identity, areaId, options);
  }

  /** Read exactly one message with its body, under the same ACS checks. */
  async displayMessage(identity: Identity, areaId: number, messageNumber: number) {
    const page = await this.read(identity, areaId, { message: messageNumber });
    if (page.messages.length !== 1 || page.messages[0].number !== messageNumber ||
        typeof page.messages[0].body !== "string") throw new NativeAccessError();
    return { area: page.area, message: page.messages[0] };
  }

  /** Group-wide bounded headers. Each area is read under its own native ACS.
   * The result is grouped by area; callers must not mistake it for one globally
   * chronological feed or for full-text search.
   */
  async listMessagesByGroup(identity: Identity, groupId: number, limitPerArea = 25) {
    if (!Number.isSafeInteger(limitPerArea) || limitPerArea < 1 || limitPerArea > 50)
      throw new NativeAccessError();
    const areas = await this.listAreasByGroup(identity, groupId);
    if (areas.length > 64) throw new NativeAccessError();
    const pages = [];
    for (const area of areas) {
      pages.push(await this.listMessages(identity, area.id, { limit: limitPerArea }));
    }
    return { groupId, pages };
  }

  async read(identity: Identity, areaId: number, options: { before?: number; limit?: number; message?: number }) {
    if (!Number.isInteger(areaId) || areaId < 1 || areaId > 65535 ||
      (options.before !== undefined && options.message !== undefined) ||
      (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50)) ||
      [options.before, options.message].some(n => n !== undefined && (!Number.isInteger(n) || n < 1 || n > 0xffffffff))) throw new NativeAccessError();
    const catalog = await this.snapshot();
    const area = catalog.areas.find(a => a.id === areaId);
    if (!area || area.kind !== "echo" || !area.groupIds?.length) throw new NativeAccessError();
    return this.native.readArea(identity, area.id, catalog.revision, async () => {
      const page = await this.storage(this.root, area.jamBase, options);
      // Ensure the catalog did not change during storage access.
      if ((await this.snapshot()).revision !== catalog.revision) throw new NativeAccessError();
      return { area: { id: area.id, name: area.name }, messages: page.messages.map(m => ({
        number: m.number, author: m.author, recipient: m.recipient, subject: m.subject,
        replyTo: m.replyTo, firstReply: m.firstReply, nextReply: m.nextReply,
        dates: m.dates, ...(m.body === undefined ? {} : { body: m.body }),
      })), nextBefore: page.nextBefore };
    });
  }
}
