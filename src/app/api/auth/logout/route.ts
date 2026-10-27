import { productionAccess, unavailable } from "@/lib/auth/service";

export async function POST(request: Request): Promise<Response> {
  const access = productionAccess();
  return access ? access.logout(request) : unavailable();
}
