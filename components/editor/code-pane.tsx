"use client";

import { AlertCircle } from "lucide-react";

import { CodeEditor } from "@/components/templates/code-editor";
import type { CodeEditorApi } from "@/components/templates/monaco-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChangeMark } from "@/lib/editor/session";
import type { TemplateKind } from "@/lib/engine/types";

export type CodeView = "code" | "result";

/**
 * Custom: the editable source (palette changes marked inline) and a read-only Result tab with
 * what will be saved. Elementor: the JSON with the swaps applied, read-only (DEVELOPMENT.md
 * Phase 5: "raw JSON view").
 */
export function CodePane({
  type,
  source,
  onSourceChange,
  result,
  marks,
  error,
  view,
  onViewChange,
  onReady,
}: {
  type: TemplateKind;
  source: string;
  onSourceChange: (source: string) => void;
  /** The content that will be saved, or null when it can't be computed. */
  result: string | null;
  marks: ChangeMark[];
  error: string | null;
  view: CodeView;
  onViewChange: (view: CodeView) => void;
  onReady: (api: CodeEditorApi | null) => void;
}) {
  const banner = error ? (
    <p
      role="alert"
      className="flex shrink-0 items-start gap-1.5 border-b border-border bg-destructive-soft px-3 py-2 text-[13px] text-destructive"
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {error}
    </p>
  ) : null;

  if (type === "elementor") {
    return (
      <section aria-label="JSON" className="flex h-full min-w-0 flex-col bg-background">
        <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            JSON
          </h2>
          <span className="ml-2 text-xs text-muted-foreground">read-only, swaps applied</span>
        </div>
        {banner}
        <div className="min-h-0 flex-1">
          <CodeEditor
            value={result ?? source}
            language="json"
            readOnly
            ariaLabel="Elementor JSON with swaps applied"
            onReady={onReady}
          />
        </div>
      </section>
    );
  }

  return (
    <Tabs
      value={view}
      onValueChange={(v) => onViewChange(v as CodeView)}
      className="flex h-full min-w-0 flex-col gap-0 bg-background"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <TabsList variant="line" aria-label="Code view">
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
        </TabsList>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {view === "code" ? "Palette changes are marked" : "What will be saved, read-only"}
        </span>
      </div>
      {banner}
      <TabsContent value="code" className="min-h-0 flex-1">
        <CodeEditor
          value={source}
          onChange={onSourceChange}
          language="html"
          ariaLabel="Template code"
          decorations={marks}
          onReady={onReady}
        />
      </TabsContent>
      <TabsContent value="result" className="min-h-0 flex-1">
        <CodeEditor
          value={result ?? ""}
          language="html"
          readOnly
          ariaLabel="Result code, read-only"
        />
      </TabsContent>
    </Tabs>
  );
}
