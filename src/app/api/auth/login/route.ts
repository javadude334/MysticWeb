import { productionAccess, unavailable } from "@/lib/auth/service";
import { sandboxLogin } from "@/lib/auth/sandbox-login";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "development")
    return sandboxLogin(request);
  const access = productionAccess();
  return access ? access.login(request) : unavailable();
}
