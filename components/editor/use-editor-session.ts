"use client";

import { useMemo, useReducer } from "react";

import {
  activeSwaps,
  activeTextSwaps,
  type ChangeMark,
  changeMarks,
  computeOutput,
  editorReducer,
  initialState,
  type OutputResult,
  summarizeChanges,
} from "@/lib/editor/session";
import {
  type Detection,
  detect,
  detectText,
  EngineError,
  type Swap,
  type TextModel,
} from "@/lib/engine";
import type { TemplateKind } from "@/lib/engine/types";
import { useDebounced } from "@/lib/hooks/use-debounced";

const EMPTY: Detection = { colors: [], images: [], fonts: [], warnings: [] };
const NO_TEXT: TextModel = { groups: [], warnings: [] };

export interface EditorSession {
  state: ReturnType<typeof initialState>;
  dispatch: React.Dispatch<Parameters<typeof editorReducer>[1]>;
  /** Detection of the (debounced) source the palette shows; ids/offsets refer to `detectedSource`. */
  detection: Detection;
  detectedSource: string;
  detectError: string | null;
  /** Palette swaps followed by Text tab edits: what is previewed and sent when saving. */
  swaps: Swap[];
  /** The Text tab's fields, read from the palette's result (DEVELOPMENT.md §7 "Text tab"). */
  textModel: TextModel;
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

  const paletteSwaps = useMemo(
    () => activeSwaps(state.pending, detection),
    [state.pending, detection],
  );
  const paletteOutput = useMemo(
    () => computeOutput(detectedSource, type, paletteSwaps),
    [detectedSource, type, paletteSwaps],
  );
  // The Text tab reads the palette's result, which is also what Text tab edits apply to.
  const textModel = useMemo(() => {
    if (!paletteOutput.ok) return NO_TEXT;
    try {
      return detectText(paletteOutput.content, type);
    } catch (error) {
      if (error instanceof EngineError) return NO_TEXT;
      throw error;
    }
  }, [paletteOutput, type]);
  const swaps = useMemo(
    () => [...paletteSwaps, ...activeTextSwaps(state.text, textModel)],
    [paletteSwaps, state.text, textModel],
  );
  const output = useMemo(
    () =>
      swaps.length === paletteSwaps.length
        ? paletteOutput
        : computeOutput(detectedSource, type, swaps),
    [swaps, paletteSwaps, paletteOutput, detectedSource, type],
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
    textModel,
    output,
    marks,
    inSync,
    codeEdited,
    dirty,
    summary: summarizeChanges(applied, codeEdited),
  };
}
