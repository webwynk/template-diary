"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, checkPickedImage } from "@/lib/images/prepare";

/** Pick one PNG/JPG/WebP (≤ 5 MB) with a local preview. Nothing is uploaded here. */
export function ImagePicker({
  value,
  onChange,
  disabled,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!file) return;
          const problem = checkPickedImage(file);
          setError(problem);
          if (!problem) onChange(file);
        }}
      />
      {preview && value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img
            src={preview}
            alt="Selected image"
            className="aspect-[16/10] w-28 shrink-0 rounded-md border border-border object-cover object-top"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{value.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {(value.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove selected image"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden />
          Choose image
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 5 MB.</p>
      )}
    </div>
  );
}
