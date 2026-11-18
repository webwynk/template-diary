"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { TagDot } from "@/components/common/tag-dot";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TAG_COLORS } from "@/lib/tags";
import { cn } from "@/lib/utils";

type TagColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  label: string;
};

/** A button showing the current tag color; opens the 10 preset colors. */
export function TagColorPicker({ value, onChange, disabled, label }: TagColorPickerProps) {
  const [open, setOpen] = useState(false);
  const current = TAG_COLORS.find((c) => c.hex.toLowerCase() === value.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${label}: ${current?.name ?? value}`}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background shadow-xs transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <TagDot color={value} className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
          {TAG_COLORS.map((c) => {
            const selected = c.hex.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c.name}
                title={c.name}
                onClick={() => {
                  onChange(c.hex);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-2",
                  selected && "bg-surface-2",
                )}
              >
                <span
                  className="flex size-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: c.hex }}
                >
                  {selected ? <Check className="size-3 text-white" aria-hidden /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
