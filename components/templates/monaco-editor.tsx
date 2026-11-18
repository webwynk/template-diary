"use client";

import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

import { EditorSkeleton } from "@/components/templates/editor-skeleton";
import { MONACO_VS_PATH } from "@/lib/monaco";

loader.config({ paths: { vs: MONACO_VS_PATH } });

/** A highlighted range (character offsets) with optional inline text shown after it. */
export interface CodeDecoration {
  start: number;
  end: number;
  after?: string;
}

/** What the rest of the app may do with a mounted editor. */
export interface CodeEditorApi {
  revealOffset: (offset: number, length?: number) => void;
}

export interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "html" | "json";
  readOnly?: boolean;
  ariaLabel: string;
  height?: number | string;
  decorations?: CodeDecoration[];
  onReady?: (api: CodeEditorApi | null) => void;
}

type EditorInstance = Parameters<OnMount>[0];

export default function MonacoEditor({
  value,
  onChange,
  language = "html",
  readOnly = false,
  ariaLabel,
  height = "100%",
  decorations,
  onReady,
}: MonacoEditorProps) {
  const editorRef = useRef<EditorInstance | null>(null);
  const collectionRef = useRef<ReturnType<EditorInstance["createDecorationsCollection"]> | null>(
    null,
  );
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    collectionRef.current = editor.createDecorationsCollection([]);
    onReadyRef.current?.({
      revealOffset(offset, length = 0) {
        const model = editor.getModel();
        if (!model) return;
        const start = model.getPositionAt(offset);
        const end = model.getPositionAt(offset + length);
        editor.setSelection({
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        });
        editor.revealRangeInCenter({
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        });
        editor.focus();
      },
    });
    applyDecorations();
  };

  function applyDecorations() {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const collection = collectionRef.current;
    if (!editor || !model || !collection) return;
    const length = model.getValueLength();
    collection.set(
      (decorations ?? [])
        .filter((d) => d.start >= 0 && d.end <= length && d.start < d.end)
        .map((d) => {
          const s = model.getPositionAt(d.start);
          const e = model.getPositionAt(d.end);
          return {
            range: {
              startLineNumber: s.lineNumber,
              startColumn: s.column,
              endLineNumber: e.lineNumber,
              endColumn: e.column,
            },
            options: {
              inlineClassName: "td-code-changed",
              ...(d.after ? { after: { content: d.after, inlineClassName: "td-code-after" } } : {}),
            },
          };
        }),
    );
  }

  // Decorations refer to offsets in `value`; re-apply whenever either changes.
  useEffect(applyDecorations);

  useEffect(() => () => onReadyRef.current?.(null), []);

  return (
    <Editor
      value={value}
      language={language}
      theme="vs"
      height={height}
      loading={<EditorSkeleton />}
      onMount={handleMount}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        ariaLabel,
        readOnly,
        domReadOnly: readOnly,
        fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
        renderWhitespace: "selection",
        padding: { top: 12, bottom: 12 },
        // Never change what the user pasted (RULES.md §6).
        formatOnPaste: false,
        formatOnType: false,
        autoClosingBrackets: "never",
        autoClosingQuotes: "never",
      }}
    />
  );
}
