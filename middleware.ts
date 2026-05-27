/**
 * When Crystal Core launches the procurement app it passes the signed-in
 * user's identity in the query string:
 *   /?u=<email>&n=<name>&r=<role>
 *
 * This middleware captures those params on any request, drops them into a
 * cookie, and redirects to the clean URL so they don't linger in the
 * address bar.  All downstream pages read the cookie via `getCurrentUser()`.
 */

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "crystal_user";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export function middleware(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("u");
  if (!email) return NextResponse.next();

  const name = req.nextUrl.searchParams.get("n") ?? "";
  const role = req.nextUrl.searchParams.get("r") ?? "";

  const cleanUrl = req.nextUrl.clone();
  cleanUrl.searchParams.delete("u");
  cleanUrl.searchParams.delete("n");
  cleanUrl.searchParams.delete("r");

  const res = NextResponse.redirect(cleanUrl);
  res.cookies.set(
    COOKIE_NAME,
    JSON.stringify({ email, name, role }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    },
  );
  return res;
}

export const config = {
  matcher: "/((?!_next/|api/|favicon.ico|.*\\.[\\w]+$).*)",
};
