import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · Template Diary",
};

// DESIGN.md §7.1: centered 400px card on white, no sign-up link.
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <h1 className="text-[30px] leading-9 font-bold tracking-[-0.01em]">Template Diary</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your template library.</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-6 shadow-xs">
          <Suspense fallback={<div className="h-[212px]" aria-hidden />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
