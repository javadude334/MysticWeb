import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const GROUP_RECORD_BYTES = 206;
const AREA_RECORD_BYTES = 768;
const ROOT = process.env.MYSTIC_DATA_ROOT ?? "/mnt/mystic-readonly";

export interface MysticGroup {
  id: number;
  name: string;
}

export interface MysticArea {
  id: number;
  name: string;
  jamBase: string;
  security: readonly [string, string, string, string];
  inferredGroupId: number | null;
}

function field(record: Buffer, offset: number, capacity: number): string {
  if (offset < 0 || capacity < 0 || offset + capacity + 1 > record.length) {
    throw new Error("Mystic configuration field is out of bounds");
  }
  const length = record[offset];
  if (length > capacity) {
    throw new Error(`Invalid Mystic string length at byte ${offset}`);
  }
  // Preserve raw 8-bit bytes. Full CP437 conversion will be added once verified.
  return record.subarray(offset + 1, offset + 1 + length).toString("latin1");
}

function splitRecords(data: Buffer, size: number): Buffer[] {
  if (data.length % size !== 0) {
    throw new Error(`Invalid Mystic configuration size: ${data.length} bytes`);
  }
  const records: Buffer[] = [];
  for (let offset = 0; offset < data.length; offset += size) {
    records.push(data.subarray(offset, offset + size));
  }
  return records;
}

export function parseMysticGroups(data: Buffer): MysticGroup[] {
  const groups = splitRecords(data, GROUP_RECORD_BYTES).map((record) => ({
    id: record.readUInt32LE(0),
    name: field(record, 4, 60),
  }));
  if (new Set(groups.map((group) => group.id)).size !== groups.length) {
    throw new Error("Duplicate Mystic group identifiers");
  }
  return groups;
}

export function parseMysticAreas(data: Buffer): MysticArea[] {
  const areas = splitRecords(data, AREA_RECORD_BYTES).map((record) => {
    const security = [263, 294, 325, 356].map((offset) =>
      field(record, offset, 30),
    ) as [string, string, string, string];
    const references = new Set<number>();
    for (const expression of security) {
      for (const match of expression.matchAll(/g(\d+)/gi)) {
        references.add(Number(match[1]));
      }
    }
    return {
      id: record.readUInt16LE(0),
      name: field(record, 2, 60),
      jamBase: field(record, 138, 40),
      security,
      inferredGroupId: references.size === 1 ? [...references][0] : null,
    };
  });
  if (new Set(areas.map((area) => area.id)).size !== areas.length) {
    throw new Error("Duplicate Mystic message-area identifiers");
  }
  return areas;
}

/**
 * Server-side only. Do not return these records to guest-facing pages or APIs.
 * Security expressions are retained as data, NOT evaluated as authorization.
 */
export async function readMysticConfiguration(): Promise<{
  groups: MysticGroup[];
  areas: MysticArea[];
}> {
  const [groupsData, areasData] = await Promise.all([
    readFile(path.join(ROOT, "data", "groups_g.dat")),
    readFile(path.join(ROOT, "data", "mbases.dat")),
  ]);
  const groups = parseMysticGroups(groupsData);
  const areas = parseMysticAreas(areasData);
  const ids = new Set(groups.map((group) => group.id));
  for (const area of areas) {
    if (area.inferredGroupId !== null && !ids.has(area.inferredGroupId)) {
      throw new Error(`Unknown security group reference in area ${area.id}`);
    }
  }
  return { groups, areas };
}
