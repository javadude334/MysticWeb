import { connection } from "next/server";
import { sandboxMessages } from "@/lib/auth/sandbox-messages";

export async function GET(request: Request): Promise<Response> {
  // Cache Components: never prerender or cache identity-dependent reads.
  await connection();
  return sandboxMessages(request);
}

/** Explicit JSON-only read receipt. Never writes Mystic JAM/JLR pointers. */
export async function POST(request: Request): Promise<Response> {
  await connection();
  return sandboxMessages(request);
}
