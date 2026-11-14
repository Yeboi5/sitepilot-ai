"use client";

import { useState, useTransition } from "react";
import { startMfaEnrollment, verifyMfaAction } from "@/app/actions/auth";

export function MfaEnroll() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ factorId: string; qrCode: string; secret: string } | { error: string } | null>(null);
  if (!state || "error" in state) {
    return (
      <div className="mt-6">
        {state && "error" in state && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{state.error}</p>}
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => setState(await startMfaEnrollment()))}>
          {pending ? "Starting…" : "Set up authenticator app"}
        </button>
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-4">
      {/* Supabase returns the QR code as an SVG data URI. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.qrCode} alt="QR code for your authenticator app" className="mx-auto h-48 w-48 rounded-lg bg-white p-2 ring-1 ring-slate-200" />
      <details className="text-center text-xs text-slate-500"><summary className="cursor-pointer">Can&apos;t scan? Enter this key</summary><code className="mt-1 block break-all">{state.secret}</code></details>
      <form action={verifyMfaAction} className="space-y-3">
        <input type="hidden" name="factorId" value={state.factorId} />
        <input type="hidden" name="back" value="/mfa/setup" />
        <label className="label" htmlFor="code">6-digit code</label>
        <input className="input text-center text-lg tracking-widest" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        <button className="btn-primary w-full" type="submit">Turn on two-step verification</button>
      </form>
    </div>
  );
}
