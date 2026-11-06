import { connection } from "next/server";
import { sandboxMessages } from "@/lib/auth/sandbox-messages";
export async function GET(request: Request): Promise<Response> {
  await connection();
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "Unavailable" }, { status: 503 });
  return sandboxMessages(request);
}
export async function POST(request: Request): Promise<Response> {
  await connection();
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "Unavailable" }, { status: 503 });
  return sandboxMessages(request);
}
