"use client";

import { DiffEditor, loader } from "@monaco-editor/react";

import { EditorSkeleton } from "@/components/templates/editor-skeleton";
import { MONACO_VS_PATH } from "@/lib/monaco";

loader.config({ paths: { vs: MONACO_VS_PATH } });

export interface MonacoDiffProps {
  original: string;
  modified: string;
  language: "html" | "json";
  /** Side by side on wide screens, one column on phones. */
  sideBySide: boolean;
  ariaLabel: string;
}

/** Read-only Monaco diff (JetBrains Mono, light theme), left = older / right = newer. */
export default function MonacoDiff({
  original,
  modified,
  language,
  sideBySide,
  ariaLabel,
}: MonacoDiffProps) {
  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme="vs"
      height="100%"
      loading={<EditorSkeleton />}
      options={{
        readOnly: true,
        originalEditable: false,
        domReadOnly: true,
        ariaLabel,
        originalAriaLabel: `${ariaLabel}, left side`,
        modifiedAriaLabel: `${ariaLabel}, right side`,
        renderSideBySide: sideBySide,
        useInlineViewWhenSpaceIsLimited: true,
        fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        diffWordWrap: "on",
        automaticLayout: true,
        renderOverviewRuler: false,
        hideUnchangedRegions: { enabled: true },
      }}
    />
  );
}
