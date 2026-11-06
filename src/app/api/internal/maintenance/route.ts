import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MaintenanceTask = "sessions.cleanup";
const supportedTasks: ReadonlySet<string> = new Set(["sessions.cleanup"]);

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.MYSTICWEB_MAINTENANCE_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: "Maintenance API not configured" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!tokenMatches(supplied, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
  }
  const task = (body as Record<string, unknown>).task;
  if (typeof task !== "string" || !supportedTasks.has(task)) {
    return NextResponse.json({ error: "Unknown maintenance task" }, { status: 400 });
  }

  // Deliberately fail closed until session storage and Mystic node ownership are wired.
  // Do not claim success or mutate native BBS records from an unverified adapter.
  const selectedTask = task as MaintenanceTask;
  return NextResponse.json({
    task: selectedTask,
    status: "not_implemented",
    message: "Session cleanup adapter and Mystic node ownership validation are pending"
  }, { status: 501 });
}
