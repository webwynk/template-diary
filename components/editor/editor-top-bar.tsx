"use client";

import { ArrowLeft, Check, ChevronDown, Lock, Palette, Save } from "lucide-react";
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

/** Editor top bar (DESIGN.md §7.5). History arrives with Phase 7. */
export function EditorTopBar({
  data,
  dirty,
  canSave,
  onBack,
  onSwitchBase,
  onSave,
  onOpenPalette,
}: {
  data: EditorData;
  dirty: boolean;
  canSave: boolean;
  onBack: () => void;
  onSwitchBase: (variationId: string) => void;
  onSave: () => void;
  /** Only on tablet, where the palette lives in a sheet. */
  onOpenPalette?: () => void;
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
        {onOpenPalette ? (
          <Button type="button" variant="secondary" size="sm" onClick={onOpenPalette}>
            <Palette aria-hidden />
            Palette
          </Button>
        ) : null}
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
      </div>
    </header>
  );
}
