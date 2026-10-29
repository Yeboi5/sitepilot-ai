import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { ACTIVE_ORG_COOKIE } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** POST-only so sign-out can't be triggered cross-site by a link or image. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(publicEnv().NEXT_PUBLIC_APP_URL).origin && origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.delete(ACTIVE_ORG_COOKIE);
  return response;
}
