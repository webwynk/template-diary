"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { saveVariationAction } from "@/actions/templates";
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
import type { Swap } from "@/lib/engine/types";
import { gzipText, MAX_UPLOAD_BYTES } from "@/lib/templates/upload";
import { variationNameSchema } from "@/lib/validation/templates";

export interface SaveRequest {
  templateId: string;
  baseVariationId: string;
  /** Base + manual edits; the server applies `swaps` to it itself. */
  source: string;
  swaps: Swap[];
  summary: string;
}

/** Save as variation (DESIGN.md §7.5). The feature image option arrives with Phase 6. */
export function SaveVariationDialog({
  open,
  onOpenChange,
  request,
  ready,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: SaveRequest;
  /** False while detection is catching up with typing; saving waits for it. */
  ready: boolean;
  onSaved: (id: string, name: string) => void;
}) {
  const ids = { name: useId(), usedIn: useId() };
  const [name, setName] = useState("");
  const [usedIn, setUsedIn] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsedName = variationNameSchema.safeParse(name);
    if (!parsedName.success) {
      setNameError(parsedName.error.issues[0]?.message ?? "Enter a name.");
      return;
    }
    startTransition(async () => {
      let gz: Blob;
      try {
        gz = await gzipText(request.source);
      } catch {
        setFormError(
          "Your browser couldn't prepare the upload. Try a current version of Chrome, Edge, Firefox or Safari.",
        );
        return;
      }
      if (gz.size > MAX_UPLOAD_BYTES) {
        setFormError("This template is too large to save. The limit is 5 MB.");
        return;
      }
      const form = new FormData();
      form.set("templateId", request.templateId);
      form.set("baseVariationId", request.baseVariationId);
      form.set("name", parsedName.data);
      form.set("usedIn", usedIn);
      form.set("swaps", JSON.stringify(request.swaps));
      form.set("source", gz, "source.gz");
      try {
        const result = await saveVariationAction(form);
        if (!result.ok) {
          if (result.field === "name") setNameError(result.error);
          else setFormError(result.error);
          return;
        }
        onSaved(result.id, parsedName.data);
      } catch {
        setFormError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={save} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Save as variation</DialogTitle>
            <DialogDescription>
              {request.summary || "No changes yet."} The version you started from stays as it is.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={ids.name}>Name</Label>
            <Input
              id={ids.name}
              value={name}
              maxLength={120}
              autoFocus
              placeholder="e.g. Robo website section"
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${ids.name}-error` : undefined}
            />
            {nameError ? <ErrorText id={`${ids.name}-error`}>{nameError}</ErrorText> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.usedIn}>
              Used in <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={ids.usedIn}
              value={usedIn}
              maxLength={2000}
              placeholder="e.g. robo-agency.com"
              onChange={(e) => setUsedIn(e.target.value)}
            />
          </div>
          {formError ? <ErrorText id="save-error">{formError}</ErrorText> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !ready}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {pending ? "Saving…" : "Save variation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ErrorText({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-[13px] text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
