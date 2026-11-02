import "server-only";
import { createHash } from "node:crypto";
import type { Identity } from "../auth/store";
import { NativeAccess, NativeAccessError } from "../auth/native";
import { isJamBaseName, readJam } from "./jam";

export interface CatalogArea { id: number; name: string; jamBase: string }
export interface Catalog { revision: string; areas: readonly CatalogArea[] }

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
        typeof a.name !== "string" || a.name.length > 60 || !isJamBaseName(a.jamBase))) throw new NativeAccessError();
    return catalog;
  }

  async areas(identity: Identity) {
    const catalog = await this.snapshot();
    const visible: { id: number; name: string }[] = [];
    const deadline = performance.now() + 4000;
    // Sequential and bounded: no unbounded bridge fan-out or shared allow cache.
    for (const area of catalog.areas) {
      if (performance.now() >= deadline) throw new NativeAccessError();
      try {
        await this.native.readArea(identity, area.id, catalog.revision, async () => {
          visible.push({ id: area.id, name: area.name });
        });
      } catch { /* inaccessible areas disclose no metadata */ }
    }
    if (performance.now() >= deadline || (await this.snapshot()).revision !== catalog.revision) throw new NativeAccessError();
    return visible;
  }

  async read(identity: Identity, areaId: number, options: { before?: number; limit?: number; message?: number }) {
    if (!Number.isInteger(areaId) || areaId < 1 || areaId > 65535 ||
      (options.before !== undefined && options.message !== undefined) ||
      (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50)) ||
      [options.before, options.message].some(n => n !== undefined && (!Number.isInteger(n) || n < 1 || n > 0xffffffff))) throw new NativeAccessError();
    const catalog = await this.snapshot();
    const area = catalog.areas.find(a => a.id === areaId);
    if (!area) throw new NativeAccessError();
    return this.native.readArea(identity, area.id, catalog.revision, async () => {
      const page = await this.storage(this.root, area.jamBase, options);
      // Ensure the catalog did not change during storage access.
      if ((await this.snapshot()).revision !== catalog.revision) throw new NativeAccessError();
      return { area: { id: area.id, name: area.name }, messages: page.messages.map(m => ({
        number: m.number, author: m.author, recipient: m.recipient, subject: m.subject,
        dates: m.dates, ...(m.body === undefined ? {} : { body: m.body }),
      })), nextBefore: page.nextBefore };
    });
  }
}
