"use client";

import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * Shown by the error.tsx boundaries when a page fails unexpectedly (Phase 11). The error's
 * details stay in the logs; the user gets a plain message, Try again and a way home.
 */
export function ErrorView({
  error,
  retry,
  fullScreen = false,
}: {
  error: unknown;
  retry: () => void;
  fullScreen?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <main
      className={
        fullScreen
          ? "flex min-h-dvh items-center justify-center px-4"
          : "mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8"
      }
    >
      <div
        role="alert"
        className="flex w-full flex-col items-center rounded-xl border border-border bg-background px-6 py-12 text-center"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-surface">
          <AlertTriangle className="size-5 text-destructive" aria-hidden />
        </div>
        <h2 className="mt-4 text-base font-semibold">Something went wrong</h2>
        <p className="mt-1 max-w-sm text-muted-foreground">
          This page couldn&apos;t load. Your templates are safe. Try again, or go back to the
          library.
        </p>
        {digest ? (
          <p className="mt-2 text-xs text-subtle-foreground">Error code: {digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => startTransition(retry)} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
            Try again
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Back to library</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
