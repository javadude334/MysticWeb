import { sandboxLogin } from "@/lib/auth/sandbox-login";
export async function POST(request: Request): Promise<Response> {
  return sandboxLogin(request);
}
