import { sandboxSession } from "@/lib/auth/sandbox-login";
export async function GET(request: Request): Promise<Response> {
  return sandboxSession(request);
}
