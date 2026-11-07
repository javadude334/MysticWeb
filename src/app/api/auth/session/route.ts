import { productionAccess, unavailable } from "@/lib/auth/service";
import { sandboxSession } from "@/lib/auth/sandbox-login";

export async function GET(request: Request): Promise<Response> {
  if ((process.env.NODE_ENV === "development" || process.env.MYSTICWEB_ENABLE_NATIVE_LOGIN === "1")) return sandboxSession(request);
  const access = productionAccess();
  return access ? access.session(request) : unavailable();
}
