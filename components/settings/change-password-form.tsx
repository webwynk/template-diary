"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";

import { changePassword, type ChangePasswordState } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ChangePasswordState = { status: "idle", message: null };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  const error = state.status === "error";

  return (
    <form action={action} className="max-w-sm space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={error ? true : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={error ? true : undefined}
        />
      </div>
      {state.message ? (
        <p
          role={error ? "alert" : "status"}
          className={
            error
              ? "text-[13px] text-destructive"
              : "flex items-center gap-1.5 text-[13px] text-success"
          }
        >
          {error ? null : <CheckCircle2 className="size-4" aria-hidden />}
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Change password
      </Button>
    </form>
  );
}
