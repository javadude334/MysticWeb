import path from "node:path";
import { verifyApiToken, apiTokenFile } from "@/lib/storage/api-token";
import { initializeMysticWebRuntime } from "@/lib/storage/runtime";
import { scanMysticMessageBases } from "@/lib/storage/message-base-catalog";
import { AuthStore } from "@/lib/auth/store";


/** Mystic Event Scheduler may invoke this endpoint using a local script.
 * No session cookie or browser authorization is accepted here.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const runtime = initializeMysticWebRuntime();
    const tokenFile = apiTokenFile(path.dirname(runtime.databasePath));
    if (!verifyApiToken(tokenFile, request.headers.get("authorization")))
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const scan = scanMysticMessageBases(runtime.directories);
    const store = new AuthStore(runtime.databasePath);
    try { store.replaceMessageBaseCatalog(scan.bases); }
    finally { store.close(); }
    return Response.json({
      updated: true,
      counts: {
        local: scan.bases.filter(b => b.category === "local").length,
        netmail: scan.bases.filter(b => b.category === "netmail").length,
        echomail: scan.bases.filter(b => b.category === "echomail").length,
        skipped: scan.skipped.length,
      },
      skipped: scan.skipped,
    });
  } catch (error) {
    console.error("MysticWeb scheduled message-base refresh failed", error);
    return Response.json({ error: "Message-base refresh failed" }, { status: 503 });
  }
}
