"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/lib/validation/account";

export type ChangePasswordState = { status: "idle" | "success" | "error"; message: string | null };

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  await getCurrentUser();
  const parsed = changePasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // Supabase explains weak/reused passwords in plain words; other errors are generic.
    const known = error.code === "weak_password" || error.code === "same_password";
    if (!known) console.error("[auth] updateUser password", error.code, error.message);
    return {
      status: "error",
      message: known ? error.message : "Couldn't change your password. Please try again.",
    };
  }
  return { status: "success", message: "Password changed." };
}
