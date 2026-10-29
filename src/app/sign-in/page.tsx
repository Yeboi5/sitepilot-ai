import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/ui";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          New to SitePilot? <Link href="/sign-up" className="font-medium text-brand-700 underline">Create an account</Link>
        </>
      }
    >
      {error === "confirmation" ? (
        <div className="mb-4">
          <Alert tone="warning">That confirmation link is invalid or has expired.</Alert>
        </div>
      ) : null}
      <SignInForm next={next} />
    </AuthCard>
  );
}
