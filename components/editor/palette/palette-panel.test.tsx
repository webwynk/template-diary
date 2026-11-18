import { fireEvent, render, screen } from "@testing-library/react";

import { PalettePanel } from "@/components/editor/palette/palette-panel";
import { editorReducer, initialState } from "@/lib/editor/session";
import { detect } from "@/lib/engine";

const HTML = `<style>.a{color:#4f46e5}.b{background:#4f46e5;font-family:"Open Sans"}.c{color:#0f172a}</style><img src="https://x.test/a.jpg">`;

function setup(state = initialState(HTML)) {
  const dispatch = vi.fn();
  const onJump = vi.fn();
  const onResetAll = vi.fn();
  render(
    <PalettePanel
      detection={detect(state.source, "custom")}
      pending={state.pending}
      dispatch={dispatch}
      onJump={onJump}
      canReset
      onResetAll={onResetAll}
    />,
  );
  return { dispatch, onJump, onResetAll };
}

describe("PalettePanel", () => {
  it("lists colors by use with counts and jumps to an occurrence", () => {
    const { onJump } = setup();
    expect(screen.getByRole("tab", { name: /colors\s*2/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /images\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /fonts\s*1/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 2 places using #4f46e5" }));
    fireEvent.click(screen.getAllByTitle("Show line 1 in the code")[0]!);
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ kind: "range", line: 1 }));
  });

  it("shows old → new, untick checkboxes and reset for a changed color", () => {
    let state = initialState(HTML);
    state = editorReducer(state, {
      type: "setTarget",
      kind: "color",
      from: "#4f46e5",
      to: "#10b981",
    });
    const { dispatch, onResetAll } = setup(state);
    expect(screen.getByText("#10b981")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 2 places using #4f46e5" }));
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[1]!);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "toggleExclude", kind: "color", from: "#4f46e5" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset #4f46e5" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "resetRow", kind: "color", from: "#4f46e5" });
    fireEvent.click(screen.getByRole("button", { name: /reset all/i }));
    expect(onResetAll).toHaveBeenCalled();
  });
});
