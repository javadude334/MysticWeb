import { productionAccess, unavailable } from "@/lib/auth/service";
import { sandboxLogout } from "@/lib/auth/sandbox-login";

export async function POST(request: Request): Promise<Response> {
  if ((process.env.NODE_ENV === "development" || process.env.MYSTICWEB_ENABLE_NATIVE_LOGIN === "1"))
    return sandboxLogout(request);
  const access = productionAccess();
  return access ? access.logout(request) : unavailable();
}
