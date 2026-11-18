import { Check, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Large selectable card for the template type (DESIGN.md §7.3). A styled native radio. */
export function TypeOption({
  name,
  value,
  checked,
  onChange,
  icon: Icon,
  title,
  description,
  disabled,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  icon: LucideIcon;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        checked
          ? "border-2 border-primary bg-primary-soft p-[15px]"
          : "border-border hover:border-border-strong",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="sr-only"
      />
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          checked ? "bg-background text-primary" : "bg-surface text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-[13px] text-muted-foreground">{description}</span>
      </span>
      {checked ? (
        <span
          className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden
        >
          <Check className="size-3.5" />
        </span>
      ) : null}
    </label>
  );
}
