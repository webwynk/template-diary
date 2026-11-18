"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  CopyPlus,
  History,
  Loader2,
  Lock,
  Palette,
  Save,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EditorData } from "@/lib/db/templates";
import { cn } from "@/lib/utils";

/** Editor top bar (DESIGN.md §7.5). */
export function EditorTopBar({
  data,
  dirty,
  canSave,
  onBack,
  onSwitchBase,
  onSave,
  onSaveChanges,
  savingChanges = false,
  onOpenPalette,
  onOpenHistory,
}: {
  data: EditorData;
  dirty: boolean;
  canSave: boolean;
  onBack: () => void;
  onSwitchBase: (variationId: string) => void;
  onSave: () => void;
  /** Only when the base is a variation (not the Original): overwrite it in place. */
  onSaveChanges?: () => void;
  savingChanges?: boolean;
  /** Only on tablet, where the palette lives in a sheet. */
  onOpenPalette?: () => void;
  onOpenHistory: () => void;
}) {
  const { template, variations, base } = data;
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:gap-3 sm:px-4">
      <Link
        href={`/templates/${template.id}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onBack();
        }}
        className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-semibold hover:bg-surface-2"
      >
        <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Back to </span>
        <span className="max-w-[28vw] truncate sm:max-w-[240px]">{template.name}</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="max-w-[40vw] min-w-0 sm:max-w-[260px]"
          >
            <span className="hidden text-muted-foreground sm:inline">Base:</span>
            {base.isOriginal ? (
              <Lock className="text-muted-foreground" aria-label="Locked" />
            ) : null}
            <span className="truncate">{base.name}</span>
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Start from
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {variations.map((v) => (
            <DropdownMenuItem
              key={v.id}
              onSelect={() => v.id !== base.id && onSwitchBase(v.id)}
              className="gap-2"
            >
              {v.isOriginal ? (
                <Lock className="text-muted-foreground" aria-label="Locked" />
              ) : (
                <span className="size-4" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{v.name}</span>
              {v.id === base.id ? <Check className="text-primary" aria-label="Current" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <p
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          !dirty && "invisible",
        )}
        aria-live="polite"
      >
        <span className="size-2 rounded-full bg-warning" aria-hidden />
        <span className="hidden md:inline">{dirty ? "Unsaved changes" : ""}</span>
        <span className="sr-only md:hidden">{dirty ? "Unsaved changes" : ""}</span>
      </p>

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenHistory}
          aria-label="History"
          title="History"
        >
          <History aria-hidden />
          <span className="hidden lg:inline">History</span>
        </Button>
        {onOpenPalette ? (
          <Button type="button" variant="secondary" size="sm" onClick={onOpenPalette}>
            <Palette aria-hidden />
            Palette
          </Button>
        ) : null}
        {onSaveChanges ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSave}
              disabled={!canSave || savingChanges}
              title="Save as a new variation"
            >
              <CopyPlus aria-hidden />
              <span className="hidden sm:inline">Save as new…</span>
              <span className="sr-only sm:hidden">Save as new variation</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSaveChanges}
              disabled={!canSave || savingChanges}
              title={
                canSave ? `Save changes to “${base.name}” (Ctrl/⌘+S)` : "Make a change to save"
              }
            >
              {savingChanges ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Save aria-hidden />
              )}
              {savingChanges ? "Saving…" : "Save changes"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={!canSave}
            title={canSave ? "Save as variation (Ctrl/⌘+S)" : "Make a change to save a variation"}
          >
            <Save aria-hidden />
            <span className="hidden sm:inline">Save as variation…</span>
            <span className="sm:hidden">Save</span>
          </Button>
        )}
      </div>
    </header>
  );
}
