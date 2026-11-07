import { productionAccess, unavailable } from "@/lib/auth/service";
import { sandboxLogin } from "@/lib/auth/sandbox-login";

export async function POST(request: Request): Promise<Response> {
  if ((process.env.NODE_ENV === "development" || process.env.MYSTICWEB_ENABLE_NATIVE_LOGIN === "1"))
    return sandboxLogin(request);
  const access = productionAccess();
  return access ? access.login(request) : unavailable();
}
