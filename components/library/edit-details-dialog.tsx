"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { updateTemplateDetailsAction } from "@/actions/library";
import { TagSelect } from "@/components/templates/new/tag-select";
import type { TagRef } from "@/components/templates/tag-pills";
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
import { Textarea } from "@/components/ui/textarea";

export interface EditableDetails {
  id: string;
  name: string;
  tagIds: string[];
  notes: string | null;
  usedIn: string | null;
}

/** "Edit details" (DESIGN.md §7.2 ⋯ menu): name, tags, notes and "used in". */
export function EditDetailsDialog({
  open,
  onOpenChange,
  template,
  tags,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EditableDetails;
  tags: TagRef[];
}) {
  const ids = { name: useId(), tags: useId(), notes: useId(), usedIn: useId() };
  const [name, setName] = useState(template.name);
  const [tagIds, setTagIds] = useState(template.tagIds.filter((t) => tags.some((x) => x.id === t)));
  const [notes, setNotes] = useState(template.notes ?? "");
  const [usedIn, setUsedIn] = useState(template.usedIn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const r = await updateTemplateDetailsAction(template.id, { name, tagIds, notes, usedIn });
        if (r.ok) onOpenChange(false);
        else setError(r.error);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={save} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Edit details</DialogTitle>
            <DialogDescription>The code and variations stay as they are.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={ids.name}>Name</Label>
            <Input
              id={ids.name}
              value={name}
              maxLength={120}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.tags}>Tags</Label>
            <TagSelect
              id={ids.tags}
              tags={tags}
              value={tagIds}
              onChange={setTagIds}
              disabled={pending}
            />
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
          <div className="space-y-2">
            <Label htmlFor={ids.notes}>
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={ids.notes}
              value={notes}
              maxLength={5000}
              rows={4}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="flex items-start gap-1.5 text-[13px] text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
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
              {pending ? "Saving…" : "Save details"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
