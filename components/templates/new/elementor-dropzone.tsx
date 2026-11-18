"use client";

import { AlertCircle, FileJson, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { MAX_CONTENT_BYTES } from "@/lib/engine/types";
import { checkContent, type ElementorInfo, formatBytes } from "@/lib/templates/content";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ElementorFile {
  name: string;
  size: number;
  content: string;
  info: ElementorInfo;
}

/** Drag-and-drop zone for an Elementor .json export (DESIGN.md §7.3). Validates in the browser. */
export function ElementorDropzone({
  value,
  onChange,
  disabled,
}: {
  value: ElementorFile | null;
  onChange: (file: ElementorFile | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function accept(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_CONTENT_BYTES) {
      setError(`This file is ${formatBytes(file.size)}. The limit is 5 MB.`);
      return;
    }
    setReading(true);
    try {
      const content = await file.text();
      const checked = checkContent(content, "elementor");
      if (!checked.ok) {
        setError(checked.error);
        onChange(null);
      } else if (checked.elementor) {
        onChange({ name: file.name, size: file.size, content, info: checked.elementor });
      }
    } catch {
      setError("This file couldn't be read. Try exporting it again.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        disabled={disabled || reading}
        onChange={(e) => void accept(e.target.files?.[0])}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
      {value ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-4">
          <span className="flex size-10 items-center justify-center rounded-lg bg-type-elementor-soft text-type-elementor">
            <FileJson className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{value.name}</p>
            <p className="text-[13px] text-muted-foreground">
              {formatBytes(value.size)} · Elementor {value.info.kind} ·{" "}
              {plural(value.info.widgets, "widget")}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} asChild>
            <label htmlFor={inputId} className="cursor-pointer">
              Choose another file
            </label>
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled) void accept(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors",
            dragging
              ? "border-primary bg-primary-soft"
              : "border-border-strong bg-surface hover:border-primary/60",
            error && !dragging && "border-destructive/60",
          )}
        >
          <Upload className="size-6 text-muted-foreground" aria-hidden />
          <span className="font-medium">
            {reading ? "Reading file…" : "Drop your Elementor .json here"}
          </span>
          <span className="text-[13px] text-muted-foreground">
            or click to choose a file · max 5 MB
          </span>
        </label>
      )}
      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-[13px] text-destructive"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
