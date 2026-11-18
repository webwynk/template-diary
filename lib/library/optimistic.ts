"use client";

import { useSyncExternalStore } from "react";

// Instant feedback for library actions (speed audit P5). The star, "Add to favorites" in the ⋯
// menu and "Move to trash" write here first, so every card, row and menu showing that template
// updates at once; the server action then saves and refreshes the page. An override is dropped
// shortly after the action settles (the refreshed page has the real value by then), or right
// away if saving fails.

export interface TemplateOverride {
  favorite?: boolean;
  trashed?: boolean;
}

const overrides = new Map<string, TemplateOverride>();
const listeners = new Set<() => void>();
const SETTLE_MS = 1000;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function setOverride(id: string, patch: TemplateOverride) {
  overrides.set(id, { ...overrides.get(id), ...patch });
  emit();
}

export function clearOverride(id: string, key: keyof TemplateOverride) {
  const current = overrides.get(id);
  if (!current || current[key] === undefined) return;
  const next = { ...current };
  delete next[key];
  if (Object.keys(next).length === 0) overrides.delete(id);
  else overrides.set(id, next);
  emit();
}

/** Clears the override after the refreshed page has had time to arrive. */
export function settleOverride(id: string, key: keyof TemplateOverride, ms = SETTLE_MS) {
  setTimeout(() => clearOverride(id, key), ms);
}

export function useTemplateOverride(id: string): TemplateOverride | undefined {
  return useSyncExternalStore(
    subscribe,
    () => overrides.get(id),
    () => undefined,
  );
}

/** Only for tests. */
export function resetOverrides() {
  overrides.clear();
  emit();
}

/**
 * Flip a template's favorite with instant feedback everywhere it's shown. Returns false when
 * saving failed (the star has flipped back by then).
 */
export async function toggleFavorite(
  id: string,
  next: boolean,
  save: () => Promise<{ ok: boolean }>,
): Promise<boolean> {
  setOverride(id, { favorite: next });
  try {
    const r = await save();
    if (!r.ok) {
      clearOverride(id, "favorite");
      return false;
    }
    settleOverride(id, "favorite");
    return true;
  } catch (error) {
    clearOverride(id, "favorite");
    throw error;
  }
}
