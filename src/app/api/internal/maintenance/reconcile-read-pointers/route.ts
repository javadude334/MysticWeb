import path from "node:path";
import { lstatSync, readFileSync } from "node:fs";
import { verifyApiToken, apiTokenFile } from "@/lib/storage/api-token";
import { initializeMysticWebRuntime } from "@/lib/storage/runtime";
import { scanMysticMessageBases } from "@/lib/storage/message-base-catalog";
import { parseJamLastRead } from "@/lib/mystic/jam-last-read";
import { AuthStore } from "@/lib/auth/store";

/** Mystic is authoritative. Never modify native JAM files or infer absent records.
 * A missing/invalid .jlr base is skipped, not reset to zero.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const runtime = initializeMysticWebRuntime();
    if (!verifyApiToken(apiTokenFile(path.dirname(runtime.databasePath)), request.headers.get("authorization")))
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const scan = scanMysticMessageBases(runtime.directories);
    const rows: Array<{ areaId: number; userId: number; lastReadMsg: number }> = [];
    const skipped: Array<{ areaId: number; reason: string }> = [...scan.skipped];
    let areas = 0;
    for (const base of scan.bases) {
      try {
        const file = path.join(base.directory, base.jamBase + ".jlr");
        const before = lstatSync(file, { bigint: true });
        if (!before.isFile() || before.isSymbolicLink() || before.size > BigInt(1048576))
          throw new Error("unsafe_native_file");
        const data = readFileSync(file);
        const after = lstatSync(file, { bigint: true });
        if (before.dev !== after.dev || before.ino !== after.ino ||
            before.size !== after.size || before.mtimeNs !== after.mtimeNs ||
            before.ctimeNs !== after.ctimeNs)
          throw new Error("native_file_changed");
        const records = parseJamLastRead(data);
        if (records.some(r => r.highReadMsg < r.lastReadMsg || r.userId > 0x7fffffff))
          throw new Error("invalid_native_pointer");
        if (rows.length + records.length > 100000) throw new Error("pointer_limit_exceeded");
        for (const record of records)
          rows.push({ areaId: base.areaId, userId: record.userId, lastReadMsg: record.lastReadMsg });
        areas++;
      } catch (error) {
        skipped.push({ areaId: base.areaId, reason: error instanceof Error ? error.message : "native_unavailable" });
      }
    }
    // Fail closed when no authoritative snapshot exists; never overwrite a
    // supplemental pointer with an invented default.
    if (!areas) return Response.json({
      mode: "native_authoritative", nativeWrites: false, sqliteWrites: false,
      error: "No verified native read-pointer files", skipped,
    }, { status: 503 });
    const store = new AuthStore(runtime.databasePath);
    let updated: { insertedOrUpdated: number };
    try { updated = store.reconcileNativeReadPointers(rows); }
    finally { store.close(); }
    return Response.json({
      mode: "native_authoritative", nativeWrites: false, sqliteWrites: true,
      verifiedAreas: areas, synchronizedPointers: updated.insertedOrUpdated, skipped,
      note: "Native Mystic last-read pointers win. Missing native records never reset SQLite; read receipts remain unchanged.",
    });
  } catch (error) {
    console.error("MysticWeb native read-pointer synchronization failed", error);
    return Response.json({ error: "Native pointer synchronization unavailable" }, { status: 503 });
  }
}
