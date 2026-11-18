"use client";

import dynamic from "next/dynamic";

import { EditorSkeleton } from "@/components/templates/editor-skeleton";

/**
 * Monaco code editor (JetBrains Mono, light theme). Loaded only in the browser and only when
 * shown, because Monaco is large (RULES.md §5).
 */
export const CodeEditor = dynamic(() => import("@/components/templates/monaco-editor"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
