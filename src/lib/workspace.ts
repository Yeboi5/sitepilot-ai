import "server-only";
import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Accounts that signed up as a conveyancing/law firm set up their firm in onboarding.
 * This is a routing hint only (user metadata is user-editable); access is enforced by RLS.
 */
export function isFirmSignup(user: Pick<User, "user_metadata"> | null | undefined): boolean {
  return user?.user_metadata?.account_type === "professional";
}

/** After sign-in: give home buyers and investors a personal workspace if they don't have one. */
export async function ensureWorkspaceAfterSignIn(supabase: Supabase, user: User | null | undefined) {
  if (!user || isFirmSignup(user)) return;
  await supabase.rpc("ensure_personal_workspace");
}
