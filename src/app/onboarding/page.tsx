import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getSessionContext, homePathFor } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your organisation" };

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/sign-in?next=/onboarding");
  if (ctx.active) redirect(homePathFor(ctx.active.organisation.type));
  return (
    <AuthCard title={`Welcome, ${ctx.user.display_name}`}>
      <OnboardingForm />
    </AuthCard>
  );
}
