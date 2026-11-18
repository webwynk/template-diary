"use server";

import { redirect } from "next/navigation";

import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  error: string | null;
  email: string;
};

// One message for every failure, so the form never reveals which emails exist (DESIGN.md §7.1).
const INVALID_LOGIN = "Incorrect email or password.";

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";
  const parsed = loginSchema.safeParse({ email: rawEmail, password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? INVALID_LOGIN, email };
  }
  if (!isAllowedEmail(parsed.data.email)) {
    return { error: INVALID_LOGIN, email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: INVALID_LOGIN, email };
  }

  // Make sure the settings row exists (defaults from DEVELOPMENT.md §5). A failure here must
  // not block signing in; the settings page recreates the row when it's missing.
  const { error: settingsError } = await supabase
    .from("user_settings")
    .upsert({ owner_id: data.user.id }, { onConflict: "owner_id", ignoreDuplicates: true });
  if (settingsError) {
    console.error("Could not create user_settings row", settingsError.code, settingsError.message);
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out failed", error.message);
  }
  redirect("/login");
}
