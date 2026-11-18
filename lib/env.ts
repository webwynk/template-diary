import { z } from "zod";

// Environment variables are validated when first used, not at import time, so that
// `next build` works in CI without Supabase credentials (no page reads them at build time).

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = z.object({
  ALLOWED_EMAIL: z.email().transform((email) => email.trim().toLowerCase()),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function getPublicEnv(): PublicEnv {
  // NEXT_PUBLIC_* must be referenced literally so Next.js can inline them in client bundles.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Missing or invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.",
    );
  }
  return parsed.data;
}

/** The single account allowed to use the app, lower-cased. Server only. */
export function getAllowedEmail(): string {
  const parsed = serverSchema.safeParse({ ALLOWED_EMAIL: process.env.ALLOWED_EMAIL });
  if (!parsed.success) {
    throw new Error("Missing or invalid ALLOWED_EMAIL. See .env.example.");
  }
  return parsed.data.ALLOWED_EMAIL;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getAllowedEmail();
}
