"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, signInSchema, signUpSchema, type FormState } from "@/lib/validation";

// Auth error messages are deliberately generic to avoid account enumeration.
// Brute-force protection: Supabase Auth rate limits (configure in supabase/config.toml / dashboard).

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Incorrect email or password, or your email isn't confirmed yet." };

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/confirm?next=/onboarding`,
    },
  });
  if (error && error.code !== "user_already_exists") {
    return { error: "We couldn't create your account. Please try again." };
  }
  // Same response whether or not the address was already registered.
  return { message: "Check your inbox to confirm your email address, then sign in." };
}
