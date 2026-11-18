"use client";

import { AlertCircle, ArrowLeft, ArrowRight, Code2, LayoutTemplate, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { createTemplateAction } from "@/actions/templates";
import { CodeEditor } from "@/components/templates/code-editor";
import { ImagePicker } from "@/components/templates/image-picker";
import {
  ElementorDropzone,
  type ElementorFile,
} from "@/components/templates/new/elementor-dropzone";
import { TagSelect } from "@/components/templates/new/tag-select";
import { TypeOption } from "@/components/templates/new/type-option";
import type { TagRef } from "@/components/templates/tag-pills";
import { uploadFeatureImage } from "@/components/templates/upload-feature-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TemplateKind } from "@/lib/engine/types";
import { requestScreenshot } from "@/lib/images/prepare";
import { byteLength, checkContent, formatBytes } from "@/lib/templates/content";
import { gzipText, MAX_UPLOAD_BYTES } from "@/lib/templates/upload";
import { templateDetailsSchema } from "@/lib/validation/templates";

type FieldErrors = Partial<Record<"name" | "type" | "notes" | "usedIn" | "tagIds", string>>;

/**
 * New template, two steps (DESIGN.md §7.3): 1. details, 2. content and feature image.
 * Saves the locked Original, then adds the image and opens the editor.
 */
export function NewTemplateForm({ tags }: { tags: TagRef[] }) {
  const ids = { name: useId(), tags: useId(), notes: useId(), usedIn: useId() };
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<TemplateKind | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [usedIn, setUsedIn] = useState("");
  const [code, setCode] = useState("");
  const [file, setFile] = useState<ElementorFile | null>(null);
  const [imageMode, setImageMode] = useState<"auto" | "upload">("auto");
  const [image, setImage] = useState<File | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function details() {
    return templateDetailsSchema.safeParse({ name, type, tagIds, notes, usedIn });
  }

  function next(event: React.FormEvent) {
    event.preventDefault();
    const parsed = details();
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in fieldErrors))
          fieldErrors[key as keyof FieldErrors] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setStep(2);
  }

  function create() {
    setFormError(null);
    const parsed = details();
    if (!parsed.success || !type) {
      setStep(1);
      return;
    }
    const content = type === "custom" ? code : (file?.content ?? "");
    const checked = checkContent(content, type);
    if (!checked.ok) {
      setFormError(checked.error);
      return;
    }

    startTransition(async () => {
      let gz: Blob;
      try {
        gz = await gzipText(content);
      } catch {
        setFormError(
          "Your browser couldn't prepare the upload. Try a current version of Chrome, Edge, Firefox or Safari.",
        );
        return;
      }
      if (gz.size > MAX_UPLOAD_BYTES) {
        setFormError(
          "This template is too large to upload. Try removing embedded images (data: URIs).",
        );
        return;
      }
      const form = new FormData();
      form.set("name", parsed.data.name);
      form.set("type", type);
      form.set("tagIds", JSON.stringify(parsed.data.tagIds));
      form.set("notes", parsed.data.notes ?? "");
      form.set("usedIn", parsed.data.usedIn ?? "");
      form.set("content", gz, "content.gz");
      const result = await createTemplateAction(form);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      const id = result.id;
      const wantsUpload = type === "elementor" || imageMode === "upload";
      if (wantsUpload && image) {
        setSavingImage(true);
        const uploaded = await uploadFeatureImage({ templateId: id, file: image });
        if (!uploaded.ok) toast.error(`Template saved, but the image wasn't: ${uploaded.error}`);
      } else if (type === "custom" && imageMode === "auto") {
        // Rendered on the server in the background; it never replaces an image added meanwhile.
        void requestScreenshot({ templateId: id, replace: false }).then((r) => {
          if (!r.ok) toast.error(`The feature image couldn't be created: ${r.error}`);
        });
      }
      router.push(`/templates/${id}/edit`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <p className="text-[13px] font-medium text-muted-foreground">
        Step {step} of 2 · {step === 1 ? "Details" : "Content"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">
        {step === 1 ? "New template" : name.trim() || "New template"}
      </h1>

      {step === 1 ? (
        <form onSubmit={next} noValidate className="mt-6 space-y-6">
          <Field id={ids.name} label="Name" error={errors.name}>
            <Input
              id={ids.name}
              value={name}
              maxLength={120}
              placeholder="e.g. Hero dark"
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${ids.name}-error` : undefined}
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium">Type</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <TypeOption
                name="type"
                value="custom"
                checked={type === "custom"}
                onChange={() => {
                  setType("custom");
                  setErrors({ ...errors, type: undefined });
                }}
                icon={Code2}
                title="Custom code"
                description="HTML + CSS + JS in one box"
              />
              <TypeOption
                name="type"
                value="elementor"
                checked={type === "elementor"}
                onChange={() => {
                  setType("elementor");
                  setErrors({ ...errors, type: undefined });
                }}
                icon={LayoutTemplate}
                title="Elementor"
                description="Upload a section or page .json export"
              />
            </div>
            {errors.type ? <FieldError id="type-error">{errors.type}</FieldError> : null}
          </fieldset>

          <Field id={ids.tags} label="Tags" optional error={errors.tagIds}>
            <TagSelect id={ids.tags} tags={tags} value={tagIds} onChange={setTagIds} />
          </Field>

          <Field
            id={ids.usedIn}
            label="Used in"
            optional
            hint="Sites or clients where you used it."
            error={errors.usedIn}
          >
            <Input
              id={ids.usedIn}
              value={usedIn}
              maxLength={2000}
              placeholder="e.g. client-x.com, robo-agency"
              onChange={(e) => setUsedIn(e.target.value)}
              aria-invalid={errors.usedIn ? true : undefined}
            />
          </Field>

          <Field id={ids.notes} label="Notes" optional error={errors.notes}>
            <Textarea
              id={ids.notes}
              value={notes}
              maxLength={5000}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              aria-invalid={errors.notes ? true : undefined}
            />
          </Field>

          <div className="flex justify-end border-t border-border pt-4">
            <Button type="submit">
              Continue
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          {type === "custom" ? (
            <div>
              <h2 className="text-sm font-medium">Code</h2>
              <p className="text-[13px] text-muted-foreground">
                Paste the whole section: HTML, &lt;style&gt; and &lt;script&gt; together. It is
                saved exactly as pasted.
              </p>
              <div className="mt-2 h-[420px] overflow-hidden rounded-xl border border-border bg-background">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language="html"
                  ariaLabel="Template code"
                />
              </div>
              <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                {formatBytes(byteLength(code))} of 5 MB
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-medium">Elementor export</h2>
              <p className="mb-2 text-[13px] text-muted-foreground">
                In Elementor: Templates → Saved Templates → Export. The file is saved exactly as
                uploaded.
              </p>
              <ElementorDropzone value={file} onChange={setFile} disabled={pending} />
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Feature image
              {type === "elementor" ? (
                <span className="font-normal text-muted-foreground"> (optional)</span>
              ) : null}
            </legend>
            {type === "custom" ? (
              <div className="flex flex-wrap gap-x-5 gap-y-2" role="radiogroup">
                {(
                  [
                    ["auto", "Create from the desktop preview"],
                    ["upload", "Upload image"],
                  ] as const
                ).map(([mode, label]) => (
                  <label key={mode} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="image-mode"
                      value={mode}
                      checked={imageMode === mode}
                      onChange={() => setImageMode(mode)}
                      disabled={pending}
                      className="size-4 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Elementor templates can&apos;t be rendered here. Without an image, a placeholder is
                shown.
              </p>
            )}
            {type === "elementor" || imageMode === "upload" ? (
              <ImagePicker value={image} onChange={setImage} disabled={pending} />
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Made automatically after saving, at 1440 px wide. You can replace it later.
              </p>
            )}
          </fieldset>

          {formError ? <FieldError id="form-error">{formError}</FieldError> : null}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={pending}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
            <Button type="button" onClick={create} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {pending ? (savingImage ? "Saving image…" : "Creating…") : "Create template"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
      </Label>
      {hint ? <p className="-mt-1 text-[13px] text-muted-foreground">{hint}</p> : null}
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-[13px] text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
