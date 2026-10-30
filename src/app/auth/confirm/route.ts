import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceAfterSignIn } from "@/lib/workspace";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Email confirmation link target (token-hash flow). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), "/dashboard");

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      await ensureWorkspaceAfterSignIn(supabase, data.user);
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/sign-in?error=confirmation", request.url));
}
