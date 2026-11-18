"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. Renders "Ctrl K" on the server. */
export function ShortcutHint({ className }: { className?: string }) {
  const mac = useSyncExternalStore(subscribe, isMac, () => false);
  return <kbd className={className}>{mac ? "⌘K" : "Ctrl K"}</kbd>;
}
