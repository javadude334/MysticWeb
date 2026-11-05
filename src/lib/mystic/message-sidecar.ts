import "server-only";
import { randomUUID } from "node:crypto";
import { readFile, lstat } from "node:fs/promises";
import path from "node:path";
import type { JamMessage } from "./jam";

/** Supplemental records only: never replace JAM or native .jlr state. */
export interface MessageSidecar {
  schemaVersion: 1;
  id: string;
  origin: { instanceId: string; areaId: number; jamBase: string; jamNumber: number; jamMessageId: string | null };
  dates: { writtenRaw: number; timezone: string | null; firstObservedAt: string };
  sync: { state: "matched" | "unresolved"; lastVerifiedAt: string };
}
export interface UserMessageReceipt {
  schemaVersion: 1;
  instanceId: string;
  userId: number;
  areaId: number;
  messages: Record<string, { readAt: string }>;
  /** Highest verified contiguous JSON read position; null means unknown. */
  lastReadJamNumber?: number | null;
  updatedAt: string;
}
const uuid = () => "mw_" + randomUUID();
const positive = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= 0xffffffff;
const safeInstance = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const safeBase = (s: string) => /^[A-Za-z0-9_][A-Za-z0-9_&!'.-]{0,39}$/.test(s) && !s.includes("..");
const safeId = (s: string) => /^mw_[0-9a-f-]{36}$/.test(s);
function validate(instanceId: string, areaId: number) {
  if (!safeInstance(instanceId) || !positive(areaId)) throw new RangeError("Invalid sidecar scope");
}
function areaDir(root: string, instanceId: string, areaId: number) {
  validate(instanceId, areaId);
  if (!path.isAbsolute(root)) throw new Error("Absolute metadata root required");
  return path.join(root, "v1", "instances", instanceId, "areas", String(areaId));
}
export function newMessageSidecar(instanceId: string, areaId: number, jamBase: string, msg: JamMessage, now = new Date()): MessageSidecar {
  validate(instanceId, areaId);
  if (!safeBase(jamBase) || !positive(msg.number) || !Number.isInteger(msg.dates.written) ||
      msg.dates.written < 0 || msg.dates.written > 0xffffffff) throw new RangeError("Invalid JAM message");
  const time = now.toISOString();
  return {
    schemaVersion: 1, id: uuid(),
    origin: { instanceId, areaId, jamBase, jamNumber: msg.number, jamMessageId: msg.messageId || null },
    dates: { writtenRaw: msg.dates.written, timezone: msg.dates.timezone, firstObservedAt: time },
    sync: { state: "matched", lastVerifiedAt: time },
  };
}
function parseMessage(value: unknown): MessageSidecar {
  const m = value as MessageSidecar;
  if (!m || m.schemaVersion !== 1 || !safeId(m.id) || !m.origin ||
      !safeInstance(m.origin.instanceId) || !positive(m.origin.areaId) ||
      !safeBase(m.origin.jamBase) || !positive(m.origin.jamNumber) ||
      (m.origin.jamMessageId !== null && (typeof m.origin.jamMessageId !== "string" || m.origin.jamMessageId.length > 512)) ||
      !m.dates || !Number.isInteger(m.dates.writtenRaw) || m.dates.writtenRaw < 0 ||
      m.dates.writtenRaw > 0xffffffff || !m.sync || !["matched", "unresolved"].includes(m.sync.state))
    throw new Error("Invalid message sidecar");
  return m;
}
async function readJSON(file: string): Promise<unknown | null> {
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1048576) throw new Error("Unsafe sidecar");
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
/** Read an existing per-user supplemental receipt, never infer read from absence. */
export async function readUserMessageReceipt(root: string, instanceId: string, areaId: number, userId: number): Promise<UserMessageReceipt | null> {
  if (!positive(userId)) throw new RangeError("Invalid user");
  const file = path.join(areaDir(root, instanceId, areaId), "users", String(userId) + ".json");
  const value = await readJSON(file);
  if (value === null) return null;
  const v = value as UserMessageReceipt;
  if (!v || v.schemaVersion !== 1 || v.instanceId !== instanceId || v.userId !== userId ||
      v.areaId !== areaId || (v.lastReadJamNumber !== undefined && v.lastReadJamNumber !== null &&
      (!positive(v.lastReadJamNumber))) || !v.messages || typeof v.messages !== "object" || Array.isArray(v.messages) ||
      Object.keys(v.messages).length > 10000 || Object.entries(v.messages).some(([id, entry]) =>
        !safeId(id) || !entry || typeof entry.readAt !== "string" || !Number.isFinite(Date.parse(entry.readAt))))
    throw new Error("Invalid user message receipt");
  return v;
}
