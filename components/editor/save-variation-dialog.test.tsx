import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SaveVariationDialog } from "@/components/editor/save-variation-dialog";

const saveVariationAction = vi.fn();
vi.mock("@/actions/templates", () => ({
  saveVariationAction: (fd: FormData) => saveVariationAction(fd),
}));
// jsdom has no CompressionStream; gzip itself is covered by lib/templates/upload.test.ts.
vi.mock("@/lib/templates/upload", () => ({
  MAX_UPLOAD_BYTES: 4 * 1024 * 1024,
  gzipText: async (text: string) => new Blob([text]),
}));

const REQUEST = {
  templateId: "t1",
  baseVariationId: "v1",
  source: '<p style="color:#4f46e5">Hi</p>',
  swaps: [{ kind: "color" as const, fromRgb: "#4f46e5", to: "#10b981" }],
  summary: "1 color changed",
};

function renderDialog(onSaved = vi.fn(), ready = true) {
  render(
    <SaveVariationDialog
      open
      onOpenChange={() => {}}
      request={REQUEST}
      ready={ready}
      onSaved={onSaved}
    />,
  );
  return onSaved;
}

describe("SaveVariationDialog", () => {
  beforeEach(() => saveVariationAction.mockReset());

  it("shows the summary and requires a name", () => {
    renderDialog();
    expect(screen.getByText(/1 color changed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save variation" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name for this variation.");
    expect(saveVariationAction).not.toHaveBeenCalled();
  });

  it("sends source, swaps and details, then reports the new id", async () => {
    saveVariationAction.mockResolvedValueOnce({ ok: true, id: "v2" });
    const onSaved = renderDialog();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: " Robo website section " },
    });
    fireEvent.change(screen.getByLabelText(/Used in/), { target: { value: "robo.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save variation" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("v2", "Robo website section"));

    const fd = saveVariationAction.mock.calls[0]![0] as FormData;
    expect(fd.get("templateId")).toBe("t1");
    expect(fd.get("baseVariationId")).toBe("v1");
    expect(fd.get("name")).toBe("Robo website section");
    expect(fd.get("usedIn")).toBe("robo.test");
    expect(JSON.parse(fd.get("swaps") as string)).toEqual(REQUEST.swaps);
    expect(await (fd.get("source") as Blob).text()).toBe(REQUEST.source);
  });

  it("shows a taken name inline next to the field", async () => {
    saveVariationAction.mockResolvedValueOnce({
      ok: false,
      error: "This template already has a variation with that name.",
      field: "name",
    });
    const onSaved = renderDialog();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Dup" } });
    fireEvent.click(screen.getByRole("button", { name: "Save variation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already has a variation");
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("waits for detection to catch up before saving", () => {
    renderDialog(vi.fn(), false);
    expect(screen.getByRole("button", { name: "Save variation" })).toBeDisabled();
  });
});
