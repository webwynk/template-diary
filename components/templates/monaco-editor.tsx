"use client";

import Editor, { loader } from "@monaco-editor/react";

import { EditorSkeleton } from "@/components/templates/editor-skeleton";
import { MONACO_VS_PATH } from "@/lib/monaco";

loader.config({ paths: { vs: MONACO_VS_PATH } });

export interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "html" | "json";
  readOnly?: boolean;
  ariaLabel: string;
  height?: number | string;
}

export default function MonacoEditor({
  value,
  onChange,
  language = "html",
  readOnly = false,
  ariaLabel,
  height = "100%",
}: MonacoEditorProps) {
  return (
    <Editor
      value={value}
      language={language}
      theme="vs"
      height={height}
      loading={<EditorSkeleton />}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        ariaLabel,
        readOnly,
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
