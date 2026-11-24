import { connection } from "next/server";

export async function GET() {
  // Opt out of prerendering so every request reflects the live server.
  await connection();

  return Response.json({
    status: "ok",
    message: "Frontend working fine",
    timestamp: new Date().toISOString(),
  });
}
