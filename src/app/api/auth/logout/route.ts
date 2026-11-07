import { sandboxLogout } from "@/lib/auth/sandbox-login";
export async function POST(request: Request): Promise<Response> {
  return sandboxLogout(request);
}
