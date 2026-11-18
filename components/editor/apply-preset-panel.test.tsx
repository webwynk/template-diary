import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ApplyPresetPanel, mappedColors } from "@/components/editor/apply-preset-panel";
import type { ColorGroup } from "@/lib/engine/types";

const listPresetsAction = vi.fn();
const countPresetUseAction = vi.fn<(id: string) => Promise<{ ok: boolean }>>(async () => ({
  ok: true,
}));
vi.mock("@/actions/presets", () => ({
  listPresetsAction: () => listPresetsAction(),
  countPresetUseAction: (id: string) => countPresetUseAction(id),
}));

const group = (rgb: string, count: number) =>
  ({ rgb, count, occurrences: [] }) as unknown as ColorGroup;
const COLORS = [group("#111111", 5), group("#222222", 3), group("#333333", 1)];
const SNAPSHOT = { "#333333": { from: "#333333", to: "#999999", excludeIds: ["a"] } };
const PRESETS = [
  {
    id: "p1",
    name: "Rarely used",
    useCount: 0,
    updatedAt: "",
    colors: [{ hex: "#000000", label: null }],
  },
  {
    id: "p2",
    name: "Robo",
    useCount: 4,
    updatedAt: "",
    colors: [
      { hex: "#aaaaaa", label: "Primary" },
      { hex: "#bbbbbb", label: null },
    ],
  },
];

function renderPanel() {
  const dispatch = vi.fn();
  const onOpenChange = vi.fn();
  const onApplied = vi.fn();
  render(
    <ApplyPresetPanel
      open
      onOpenChange={onOpenChange}
      colors={COLORS}
      pendingColors={SNAPSHOT}
      dispatch={dispatch}
      onApplied={onApplied}
    />,
  );
  return { dispatch, onOpenChange, onApplied };
}

beforeEach(() => {
  listPresetsAction.mockReset();
  countPresetUseAction.mockClear();
  listPresetsAction.mockResolvedValue({ ok: true, presets: PRESETS });
});

describe("ApplyPresetPanel", () => {
  it("suggests a mapping by usage and applies it live", async () => {
    const { dispatch, onApplied, onOpenChange } = renderPanel();
    const select = await screen.findByLabelText("Palette");
    // Most used palettes first.
    expect([...(select as HTMLSelectElement).options].map((o) => o.text)).toEqual([
      "Choose a palette…",
      "Robo (2 colors)",
      "Rarely used (1 color)",
    ]);
    fireEvent.change(select, { target: { value: "p2" } });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "setColors",
      color: {
        "#111111": { from: "#111111", to: "#aaaaaa", excludeIds: [] },
        "#222222": { from: "#222222", to: "#bbbbbb", excludeIds: [] },
        "#333333": SNAPSHOT["#333333"],
      },
    });
    fireEvent.change(screen.getByLabelText("New color for #111111"), { target: { value: "" } });
    expect(dispatch.mock.lastCall![0].color["#111111"]).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Apply mapping" }));
    expect(countPresetUseAction).toHaveBeenCalledWith("p2");
    expect(onApplied).toHaveBeenCalledWith("Robo");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cancel puts the colors back exactly as they were", async () => {
    const { dispatch } = renderPanel();
    fireEvent.change(await screen.findByLabelText("Palette"), { target: { value: "p2" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: "setColors", color: SNAPSHOT });
    expect(countPresetUseAction).not.toHaveBeenCalled();
  });

  it("explains when there are no palettes, and shows load errors", async () => {
    listPresetsAction.mockResolvedValueOnce({ ok: true, presets: [] });
    renderPanel();
    expect(await screen.findByText(/no palettes yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply mapping" })).toBeDisabled();
  });

  it("shows a load error", async () => {
    listPresetsAction.mockResolvedValueOnce({ ok: false, error: "Nope." });
    renderPanel();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Nope."));
  });
});

describe("mappedColors", () => {
  it("keeps rows mapped to Keep and the exclusions of changed rows", () => {
    expect(mappedColors(SNAPSHOT, { "#333333": "#cccccc", "#111111": null })).toEqual({
      "#333333": { from: "#333333", to: "#cccccc", excludeIds: ["a"] },
    });
  });
});
