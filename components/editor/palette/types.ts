import type { EditorAction, EditorState } from "@/lib/editor/session";
import type { Detection, Location } from "@/lib/engine/types";

export interface PaletteProps {
  detection: Detection;
  pending: EditorState["pending"];
  dispatch: (action: EditorAction) => void;
  /** Reveal a location in the code; undefined when there is no editable code (Elementor). */
  onJump?: (location: Location) => void;
}
