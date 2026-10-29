import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have an account? <Link href="/sign-in" className="font-medium text-brand-700 underline">Sign in</Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
