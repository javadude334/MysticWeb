import { connection } from "next/server";

export async function GET() {
  await connection();
  return Response.json(
    { status: "ok", revision: process.env.MYSTICWEB_REVISION ?? "development" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
