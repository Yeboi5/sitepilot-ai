import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Email confirmation landing. Supports the PKCE flow (?code=) and the token-hash flow
 * (?token_hash=&type=) used by custom email templates. Redirects are always same-site.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  const sb = await supabaseServer();
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return to("/app?notice=Email%20confirmed.%20Welcome%20to%20DealPilot");
  } else if (tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return to("/app?notice=Email%20confirmed.%20Welcome%20to%20DealPilot");
  }
  return to("/sign-in?error=That%20confirmation%20link%20is%20invalid%20or%20has%20expired.%20Sign%20in%20to%20request%20a%20new%20one.");
}
