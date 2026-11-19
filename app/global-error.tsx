"use client";

import "./globals.css";

import { ErrorView } from "@/components/common/error-view";

// Last resort when the root layout itself fails. It renders its own document (no root layout),
// so it imports the global styles itself.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="light h-full">
      <body className="flex min-h-full flex-col font-sans">
        <title>Something went wrong · Template Diary</title>
        <ErrorView error={error} retry={retry} fullScreen />
      </body>
    </html>
  );
}
