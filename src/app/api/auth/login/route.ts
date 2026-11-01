import { productionAccess, unavailable } from "@/lib/auth/service";
import { sandboxLogin } from "@/lib/auth/sandbox-login";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "development" && process.env.MYSTICWEB_ENABLE_SANDBOX_LOGIN === "true")
    return sandboxLogin(request);
  const access = productionAccess();
  return access ? access.login(request) : unavailable();
}
