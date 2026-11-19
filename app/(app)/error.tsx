"use client";

import { ErrorView } from "@/components/common/error-view";

// Any page inside the app shell that fails: the sidebar stays, the page shows Try again.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
