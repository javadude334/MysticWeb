import { connection } from "next/server";
import { productionAccess, unavailable } from "@/lib/auth/service";

export async function GET(request: Request): Promise<Response> {
  // Cache Components: never prerender or cache identity-dependent reads.
  await connection();
  const access = productionAccess();
  return access ? access.read(request) : unavailable();
}
