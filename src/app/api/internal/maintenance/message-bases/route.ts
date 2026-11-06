import { createHash, timingSafeEqual } from "node:crypto";
import { initializeMysticWebRuntime } from "@/lib/storage/runtime";
import { scanMysticMessageBases } from "@/lib/storage/message-base-catalog";
import { AuthStore } from "@/lib/auth/store";


function authorized(request: Request): boolean {
  const secret = process.env.MYSTICWEB_MAINTENANCE_TOKEN;
  if (!secret || secret.length < 32) return false;
  const provided = request.headers.get("authorization");
  if (!provided || !provided.startsWith("Bearer ")) return false;
  const token = provided.slice(7);
  if (token.length !== secret.length) return false;
  return timingSafeEqual(
    createHash("sha256").update(token).digest(),
    createHash("sha256").update(secret).digest(),
  );
}

/** Mystic Event Scheduler may invoke this endpoint using a local script.
 * No session cookie or browser authorization is accepted here.
 */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const runtime = initializeMysticWebRuntime();
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
