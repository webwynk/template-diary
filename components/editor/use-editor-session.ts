"use client";

import { useMemo, useReducer } from "react";

import {
  activeSwaps,
  type ChangeMark,
  changeMarks,
  computeOutput,
  editorReducer,
  initialState,
  type OutputResult,
  summarizeChanges,
} from "@/lib/editor/session";
import { type Detection, detect, EngineError, type Swap } from "@/lib/engine";
import type { TemplateKind } from "@/lib/engine/types";
import { useDebounced } from "@/lib/hooks/use-debounced";

const EMPTY: Detection = { colors: [], images: [], fonts: [], warnings: [] };

export interface EditorSession {
  state: ReturnType<typeof initialState>;
  dispatch: React.Dispatch<Parameters<typeof editorReducer>[1]>;
  /** Detection of the (debounced) source the palette shows; ids/offsets refer to `detectedSource`. */
  detection: Detection;
  detectedSource: string;
  detectError: string | null;
  swaps: Swap[];
  output: OutputResult;
  /** Changed ranges in `state.source`; empty while detection is catching up with typing. */
  marks: ChangeMark[];
  /** False for up to 300 ms after typing, until detection has caught up with the source. */
  inSync: boolean;
  codeEdited: boolean;
  dirty: boolean;
  summary: string;
}

/** Wires lib/editor/session into React with 300 ms debounced detection (DESIGN.md §7.5). */
export function useEditorSession(base: string, type: TemplateKind): EditorSession {
  const [state, dispatch] = useReducer(editorReducer, base, initialState);
  const detectedSource = useDebounced(state.source, 300);

  const { detection, detectError } = useMemo(() => {
    try {
      return { detection: detect(detectedSource, type), detectError: null };
    } catch (error) {
      if (error instanceof EngineError) return { detection: EMPTY, detectError: error.message };
      throw error;
    }
  }, [detectedSource, type]);

  const swaps = useMemo(() => activeSwaps(state.pending, detection), [state.pending, detection]);
  const output = useMemo(
    () => computeOutput(detectedSource, type, swaps),
    [detectedSource, type, swaps],
  );

  const inSync = detectedSource === state.source;
  const marks = useMemo(
    () => (inSync && type === "custom" ? changeMarks(detection, swaps) : []),
    [inSync, type, detection, swaps],
  );

  const codeEdited = state.source !== base;
  const applied = output.ok ? output.applied : [];
  const dirty = codeEdited || applied.length > 0;
  return {
    state,
    dispatch,
    detection,
    detectedSource,
    detectError,
    swaps,
    output,
    marks,
    inSync,
    codeEdited,
    dirty,
    summary: summarizeChanges(applied, codeEdited),
  };
}
