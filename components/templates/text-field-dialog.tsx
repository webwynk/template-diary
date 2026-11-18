"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A one-field dialog (rename, "used in", duplicate). `onSubmit` returns an error message to show,
 * or null when done; the dialog closes itself on success. Remount it per opening with a `key`.
 */
export function TextFieldDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  initialValue,
  placeholder,
  maxLength,
  optional = false,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  maxLength: number;
  optional?: boolean;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (value: string) => Promise<string | null>;
}) {
  const id = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const message = await onSubmit(value);
        if (message) setError(message);
        else onOpenChange(false);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{label}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={id}>
              {label}
              {optional ? (
                <span className="font-normal text-muted-foreground"> (optional)</span>
              ) : null}
            </Label>
            <Input
              id={id}
              value={value}
              maxLength={maxLength}
              placeholder={placeholder}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            {error ? (
              <p
                id={`${id}-error`}
                role="alert"
                className="flex items-start gap-1.5 text-[13px] text-destructive"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {pending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
