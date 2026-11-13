import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap edge check: send signed-out visitors of protected areas to sign-in,
 * remembering where they were going. Real verification (signature, expiry,
 * role) happens server-side in requireUser().
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.has("dp_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/biz/:path*", "/admin/:path*", "/api/documents/:path*"] };
