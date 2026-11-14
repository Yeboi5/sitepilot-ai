import Link from "next/link";
import { Flash } from "@/components/ui";
import { requireSignedIn } from "@/lib/auth/session";
import { flash, type SearchParams } from "@/lib/page";
import { MfaEnroll } from "./mfa-enroll";

export const dynamic = "force-dynamic";
export const metadata = { title: "Two-step verification" };

export default async function MfaSetup({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { user, aal } = await requireSignedIn();
  const enrolled = aal?.next === "aal2";
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Two-step verification</h1>
      {f.get("required") && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your {user.role} account must use two-step verification before continuing.</p>}
      <Flash error={f.error} notice={f.notice} />
      {enrolled ? (
        <p className="mt-4 text-sm text-slate-700">Two-step verification is on for this account. <Link className="text-brand-700 underline" href="/">Continue</Link></p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">Scan the QR code with an authenticator app (such as 1Password, Google Authenticator or Microsoft Authenticator), then enter the 6-digit code.</p>
          <MfaEnroll />
        </>
      )}
    </div>
  );
}
