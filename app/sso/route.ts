/**
 * GET /sso?token=<JWT>&return=<optional path>
 *
 * Entry point used by Crystal Core's launcher.
 * Crystal Core mints a short-lived JWT and redirects the user here.
 * We verify the token by calling Core's /api/auth/verify, then drop
 * a session cookie with the user's email and send them to the dashboard.
 */

import { NextRequest, NextResponse } from "next/server";

const CORE_URL =
  process.env.CRYSTAL_CORE_URL ||
  "https://crystal-core-official-version.vercel.app";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const returnTo = req.nextUrl.searchParams.get("return") || "/";

  if (!token) {
    return NextResponse.redirect(new URL("/?error=missing_token", req.url));
  }

  let userEmail = "";
  try {
    const res = await fetch(`${CORE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, system: "procurement" }),
      cache: "no-store",
    });
    const json = await res.json();

    if (!res.ok || !json.ok || !json.data?.allowed) {
      const code = json?.error?.code ?? "sso_failed";
      return NextResponse.redirect(new URL(`/?error=${code}`, req.url));
    }

    userEmail = json.data.user.email;
  } catch {
    return NextResponse.redirect(new URL("/?error=sso_unreachable", req.url));
  }

  const response = NextResponse.redirect(new URL(returnTo, req.url));
  response.cookies.set("crystal_user_email", userEmail, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
