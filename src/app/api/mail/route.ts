import { connection } from "next/server";
import { sandboxMessages } from "@/lib/auth/sandbox-messages";
export async function GET(request: Request): Promise<Response> {
  await connection();
  return sandboxMessages(request);
}
export async function POST(request: Request): Promise<Response> {
  await connection();
  return sandboxMessages(request);
}
