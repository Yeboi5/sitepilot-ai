import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** No browser code reads the auth cookie, so keep it out of reach of scripts. */
export function hardenCookie<T extends object>(options: T): T & { httpOnly: true; secure: boolean; sameSite: "lax" } {
  return { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" };
}

/**
 * Per-request Supabase client bound to the user's auth cookies (anon/publishable key only).
 * Used for authentication. Data access goes through the Store, which enforces authorisation in
 * the service layer, with RLS as a second line of defence.
 */
export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, hardenCookie(options));
        } catch {
          // Called from a server component, where cookies are read-only; middleware refreshes them.
        }
      },
    },
  });
}
