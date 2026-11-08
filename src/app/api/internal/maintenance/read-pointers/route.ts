import path from "node:path";
import { readFileSync } from "node:fs";
import { verifyApiToken, apiTokenFile } from "@/lib/storage/api-token";
import { initializeMysticWebRuntime } from "@/lib/storage/runtime";
import { scanMysticMessageBases } from "@/lib/storage/message-base-catalog";
import { AuthStore } from "@/lib/auth/store";
import { parseJamLastRead, findJamLastRead } from "@/lib/mystic/jam-last-read";

/**
 * Read-only post-pack diagnostic. This does NOT reconcile or rewrite native
 * .jlr records or SQLite read receipts. JAM numbers can change on packing,
 * so a numeric mismatch alone is not evidence that a pointer should move.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const runtime = initializeMysticWebRuntime();
    if (!verifyApiToken(apiTokenFile(path.dirname(runtime.databasePath)), request.headers.get("authorization")))
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const scan = scanMysticMessageBases(runtime.directories);
    const areas = new Map(scan.bases.map(base => [base.areaId, base]));
    const store = new AuthStore(runtime.databasePath);
    let pointers: ReturnType<AuthStore["listMessageReadPointers"]>;
    try { pointers = store.listMessageReadPointers(); }
    finally { store.close(); }
    const reports: Array<{ areaId: number; userId: number; status: string }> = [];
    const nativeCache = new Map<number, ReturnType<typeof parseJamLastRead> | null>();
    for (const pointer of pointers) {
      const base = areas.get(pointer.areaId);
      if (!base) {
        reports.push({ areaId: pointer.areaId, userId: pointer.userId, status: "area_not_in_catalog" });
        continue;
      }
      if (!nativeCache.has(base.areaId)) {
        try {
          const file = path.join(base.directory, base.jamBase + ".jlr");
          nativeCache.set(base.areaId, parseJamLastRead(readFileSync(file)));
        } catch {
          nativeCache.set(base.areaId, null);
        }
      }
      const native = nativeCache.get(base.areaId);
      if (!native) {
        reports.push({ areaId: pointer.areaId, userId: pointer.userId, status: "native_pointer_unavailable" });
        continue;
      }
      const record = findJamLastRead(native, pointer.userId);
      reports.push({
        areaId: pointer.areaId, userId: pointer.userId,
        status: !record ? "native_user_record_missing"
          : record.lastReadMsg === pointer.lastReadJamNumber ? "number_matches"
          : "number_differs_identity_unverified",
      });
    }
    return Response.json({
      mode: "audit_only", nativeWrites: false, sqliteWrites: false,
      scannedPointers: pointers.length, skippedAreas: scan.skipped.length,
      note: "Numeric equality is diagnostic only; it does not establish message identity or Mystic read semantics.",
      reports,
    });
  } catch (error) {
    console.error("MysticWeb read-pointer audit failed", error);
    return Response.json({ error: "Read-pointer audit unavailable" }, { status: 503 });
  }
}
