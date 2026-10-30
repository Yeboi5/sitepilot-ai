import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { continueWithPersonalWorkspace } from "@/app/org-actions";
import { AuthCard } from "@/components/auth-card";
import { Alert, Button } from "@/components/ui";
import { getSessionContext, homePathFor } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your account" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/sign-in?next=/onboarding");
  if (ctx.active) redirect(homePathFor(ctx.active.organisation.type));
  const { error } = await searchParams;

  return (
    <AuthCard title={`Welcome, ${ctx.user.display_name}`}>
      {error ? (
        <div className="mb-4">
          <Alert tone="danger">We couldn&apos;t set up your workspace. Please try again.</Alert>
        </div>
      ) : null}
      <form action={continueWithPersonalWorkspace} className="space-y-2">
        <p className="text-sm text-slate-700">Buying a home or looking for an investment?</p>
        <Button type="submit" className="w-full">
          Continue with a personal workspace
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
        <span className="h-px flex-1 bg-sand-200" /> or set up an organisation <span className="h-px flex-1 bg-sand-200" />
      </div>
      <OnboardingForm />
    </AuthCard>
  );
}
