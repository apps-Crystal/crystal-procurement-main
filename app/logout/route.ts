import { NextResponse } from "next/server";

const CORE_URL =
  process.env.CRYSTAL_CORE_URL ||
  "https://crystal-core-official-version.vercel.app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const response = NextResponse.redirect(CORE_URL);
  response.cookies.set("crystal_user_email", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
