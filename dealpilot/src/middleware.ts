import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/app", "/biz", "/admin", "/api/documents", "/api/account"];

/**
 * Supabase driver: refreshes the auth session on every request (rotating tokens into httpOnly
 * cookies) and sends signed-out visitors of protected areas to sign-in. Demo driver: checks for
 * the demo session cookie. Either way, real verification (JWT validation, role, MFA level)
 * happens server-side in requireUser() — middleware is not the security boundary.
 */
export async function middleware(req: NextRequest) {
  const isProtected = PROTECTED.some((p) => req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith(`${p}/`));
  const toSignIn = () => {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  };

  if (process.env.DATA_DRIVER === "supabase") {
    let res = NextResponse.next({ request: req });
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          // Keep the auth cookie away from scripts (no browser code needs it).
          for (const { name, value, options } of list) res.cookies.set(name, value, { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
        },
      },
    });
    const { data } = await sb.auth.getUser();
    if (isProtected && !data.user) return toSignIn();
    return res;
  }

  if (isProtected && !req.cookies.has("dp_session")) return toSignIn();
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
