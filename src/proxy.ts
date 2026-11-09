import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "hotel_session";

/**
 * Fast first gate: no session cookie → login screen.
 * The cookie's signature, the user's status and permissions are verified on the server
 * (dashboard layout and every API route), so a forged cookie gets no further than here.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
