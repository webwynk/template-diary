import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PresetDialog } from "@/components/palettes/preset-dialog";

function renderDialog(onSubmit = vi.fn(async () => null as string | null)) {
  const onOpenChange = vi.fn();
  render(
    <PresetDialog
      open
      onOpenChange={onOpenChange}
      title="New palette"
      submitLabel="Create palette"
      initialName="Robo"
      initialColors={[
        { hex: "#111111", label: "Primary" },
        { hex: "#222222", label: null },
      ]}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, onOpenChange };
}

describe("PresetDialog", () => {
  it("adds, reorders and removes colors, and submits normalized values", async () => {
    const { onSubmit, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add color" }));
    fireEvent.change(screen.getByLabelText("Hex for color 3"), { target: { value: "ABC" } });
    fireEvent.click(screen.getByRole("button", { name: "Move color 3 up" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove color 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Create palette" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Robo",
      colors: [
        { hex: "#aabbcc", label: null },
        { hex: "#222222", label: null },
      ],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows validation and server errors without closing", async () => {
    const { onSubmit, onOpenChange } = renderDialog(vi.fn(async () => "Name taken."));
    fireEvent.change(screen.getByLabelText("Hex for color 1"), { target: { value: "#12" } });
    fireEvent.click(screen.getByRole("button", { name: "Create palette" }));
    expect(screen.getByRole("alert")).toHaveTextContent("“#12” is not a hex color");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Hex for color 1"), { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Create palette" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Name taken.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("never removes the last color", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Remove color 1" }));
    expect(screen.getByRole("button", { name: "Remove color 1" })).toBeDisabled();
  });
});
