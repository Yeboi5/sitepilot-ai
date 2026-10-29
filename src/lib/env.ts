import { z } from "zod";

// Only NEXT_PUBLIC_* values may reach the browser. Server secrets (e.g. the Supabase
// service-role key) must never be added here — read them in server-only modules.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (!cached) {
    const parsed = publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
    });
    if (!parsed.success) {
      throw new Error(
        `Missing or invalid environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}
