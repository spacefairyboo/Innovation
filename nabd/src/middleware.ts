/* Route guard: every page requires a session cookie except /login.
   Signed-in visitors to /login bounce back to the dashboard. */

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "nabd_uid";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return hasSession
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except static assets and framework internals.
  matcher: ["/((?!_next|favicon.ico|models|basis|.*\\.(?:png|jpg|svg|glb|wasm)).*)"],
};
