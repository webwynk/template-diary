"use client";

import { ErrorView } from "@/components/common/error-view";

export default function EditorError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} fullScreen />;
}
