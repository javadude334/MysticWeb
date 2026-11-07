import { connection } from "next/server";
import { sandboxMessages } from "@/lib/auth/sandbox-messages";
import { productionAccess, unavailable } from "@/lib/auth/service";

export async function GET(request: Request): Promise<Response> {
  // Cache Components: never prerender or cache identity-dependent reads.
  await connection();
  if (process.env.NODE_ENV === "development" || process.env.MYSTICWEB_ENABLE_NATIVE_LOGIN === "1") return sandboxMessages(request);
  const access = productionAccess();
  return access ? access.read(request) : unavailable();
}

/** Explicit JSON-only read receipt. Never writes Mystic JAM/JLR pointers. */
export async function POST(request: Request): Promise<Response> {
  await connection();
  if (process.env.NODE_ENV === "development" || process.env.MYSTICWEB_ENABLE_NATIVE_LOGIN === "1") return sandboxMessages(request);
  return unavailable();
}
