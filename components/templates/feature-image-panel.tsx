"use client";

import { ImagePlus, Loader2, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { removeFeatureImageAction } from "@/actions/feature-images";
import { TemplateThumb } from "@/components/templates/template-thumb";
import { uploadFeatureImage } from "@/components/templates/upload-feature-image";
import { Button } from "@/components/ui/button";
import type { TemplateKind } from "@/lib/engine/types";
import { ACCEPTED_IMAGE_TYPES, requestScreenshot } from "@/lib/images/prepare";

type Busy = "upload" | "generate" | "remove" | null;

/** Feature image on the template overview with Upload / Generate / Remove (DESIGN.md §7.4). */
export function FeatureImagePanel({
  templateId,
  name,
  type,
  src,
  source,
}: {
  templateId: string;
  name: string;
  type: TemplateKind;
  src: string | null;
  source: "none" | "auto" | "upload";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [shown, setShown] = useState(src);
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setShown(src);
  }

  async function upload(file: File) {
    setBusy("upload");
    const result = await uploadFeatureImage({ templateId, file });
    setBusy(null);
    if (!result.ok) return void toast.error(result.error);
    if (result.url) setShown(result.url);
    toast.success("Feature image updated");
  }

  async function generate() {
    setBusy("generate");
    const result = await requestScreenshot({ templateId, replace: true });
    setBusy(null);
    if (!result.ok) return void toast.error(result.error);
    if (result.url) setShown(result.url);
    toast.success("Feature image created from the desktop preview");
    router.refresh();
  }

  async function remove() {
    setBusy("remove");
    const form = new FormData();
    form.set("templateId", templateId);
    try {
      const result = await removeFeatureImageAction(form);
      if (!result.ok) return void toast.error(result.error);
      setShown(null);
    } catch {
      toast.error("Couldn't remove the image. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-border">
        <TemplateThumb name={name} type={type} src={shown} />
        {busy === "generate" || busy === "upload" ? (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm font-medium"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {busy === "generate" ? "Creating image from the preview…" : "Uploading…"}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden />
          {shown ? "Replace image" : "Upload image"}
        </Button>
        {type === "custom" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => void generate()}
          >
            <Wand2 aria-hidden />
            {source === "auto" && shown ? "Regenerate" : "Generate from preview"}
          </Button>
        ) : null}
        {shown ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => void remove()}
          >
            {busy === "remove" ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Trash2 aria-hidden />
            )}
            Remove
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {shown
            ? source === "upload"
              ? "Uploaded image"
              : "From the desktop preview"
            : "PNG, JPG or WebP, up to 5 MB"}
        </span>
      </div>
    </div>
  );
}
