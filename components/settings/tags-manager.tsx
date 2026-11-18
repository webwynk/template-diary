"use client";

import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createTagAction, deleteTagAction, updateTagAction } from "@/actions/tags";
import { EmptyState } from "@/components/common/empty-state";
import { TagColorPicker } from "@/components/settings/tag-color-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_TAG_COLOR, type TagWithCount } from "@/lib/tags";
import { tagNameSchema } from "@/lib/validation/tags";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function TagsManager({ tags }: { tags: TagWithCount[] }) {
  return (
    <div className="space-y-6">
      <CreateTagForm />
      {tags.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No tags yet"
          description="Create tags like Hero, Pricing or Footer to group your templates."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden grid-cols-[1fr_140px_120px] items-center gap-4 border-b border-border bg-surface px-4 py-2.5 text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase sm:grid">
            <span>Tag</span>
            <span>Templates</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y divide-border">
            {tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CreateTagForm() {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_TAG_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = tagNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a tag name.");
      return;
    }
    startTransition(async () => {
      const result = await createTagAction({ name: parsed.data, color });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Tag "${parsed.data}" created`);
      setName("");
      setColor(DEFAULT_TAG_COLOR);
      setError(null);
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="new-tag" className="text-sm font-medium">
        New tag
      </label>
      <div className="mt-2 flex gap-2">
        <TagColorPicker value={color} onChange={setColor} disabled={pending} label="Tag color" />
        <Input
          id="new-tag"
          value={name}
          maxLength={40}
          placeholder="e.g. Hero"
          disabled={pending}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-tag-error" : undefined}
          className="max-w-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Add
        </Button>
      </div>
      {error ? (
        <p id="new-tag-error" role="alert" className="mt-2 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function TagRow({ tag }: { tag: TagWithCount }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = tagNameSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a tag name.");
      return;
    }
    if (parsed.data === tag.name) {
      setEditing(false);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await updateTagAction({ id: tag.id, name: parsed.data });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Renamed to "${parsed.data}"`);
      setEditing(false);
      setError(null);
    });
  }

  function cancel() {
    setDraft(tag.name);
    setEditing(false);
    setError(null);
  }

  function changeColor(hex: string) {
    if (hex === tag.color) return;
    startTransition(async () => {
      const result = await updateTagAction({ id: tag.id, color: hex });
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTagAction({ id: tag.id });
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Tag "${tag.name}" deleted`);
    });
  }

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[1fr_140px_120px]">
      <div className="flex min-w-0 items-center gap-3">
        <TagColorPicker
          value={tag.color}
          onChange={changeColor}
          disabled={pending}
          label={`Color for ${tag.name}`}
        />
        {editing ? (
          <div className="min-w-0 flex-1">
            <Input
              value={draft}
              maxLength={40}
              autoFocus
              disabled={pending}
              aria-label={`Rename ${tag.name}`}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
                if (e.key === "Escape") cancel();
              }}
            />
            {error ? (
              <p role="alert" className="mt-1 text-[13px] text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="truncate font-medium">{tag.name}</span>
        )}
      </div>

      <span className="col-start-1 row-start-2 pl-12 text-[13px] text-muted-foreground tabular-nums sm:col-start-auto sm:row-start-auto sm:pl-0 sm:text-sm">
        {plural(tag.templateCount, "template")}
      </span>

      <div className="col-start-2 row-span-2 row-start-1 flex justify-end gap-1 sm:col-start-auto sm:row-span-1 sm:row-start-auto">
        {editing ? (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={save}
              disabled={pending}
              aria-label="Save name"
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={cancel}
              disabled={pending}
              aria-label="Cancel rename"
            >
              <X aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setDraft(tag.name);
                setEditing(true);
              }}
              disabled={pending}
              aria-label={`Rename ${tag.name}`}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              aria-label={`Delete ${tag.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 aria-hidden />
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the tag &ldquo;{tag.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {tag.templateCount > 0
                ? `It will be removed from ${plural(tag.templateCount, "template")}. The templates themselves are not deleted.`
                : "No templates use this tag."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                // Keep the dialog open until the delete finishes.
                e.preventDefault();
                remove();
              }}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Delete tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
