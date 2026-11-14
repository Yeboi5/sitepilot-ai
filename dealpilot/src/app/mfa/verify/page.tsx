import { redirect } from "next/navigation";
import { Flash } from "@/components/ui";
import { requireSignedIn } from "@/lib/auth/session";
import { flash, type SearchParams } from "@/lib/page";
import { supabaseServer } from "@/lib/supabase/server";
import { signOutAction, verifyMfaAction } from "../../actions/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify sign-in" };

export default async function MfaVerify({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { aal } = await requireSignedIn();
  if (!aal || aal.next !== "aal2") redirect("/");
  if (aal.current === "aal2") redirect("/");
  const { data } = await (await supabaseServer()).auth.mfa.listFactors();
  const factor = data?.totp?.[0];
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold">Enter your verification code</h1>
      <p className="mt-2 text-sm text-slate-600">Open your authenticator app and enter the 6-digit code for DealPilot.</p>
      <Flash error={f.error} />
      {factor ? (
        <form action={verifyMfaAction} className="mt-4 space-y-3">
          <input type="hidden" name="factorId" value={factor.id} />
          <input className="input text-center text-lg tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required aria-label="6-digit code" />
          <button className="btn-primary w-full" type="submit">Verify</button>
        </form>
      ) : <p className="mt-4 text-sm text-red-700">No authenticator is enrolled. Contact support.</p>}
      <form action={signOutAction} className="mt-4"><button className="text-sm text-slate-600 underline" type="submit">Sign out</button></form>
    </div>
  );
}
