import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { daysLeft, TrashList } from "@/components/trash/trash-list";

const actions = vi.hoisted(() => ({
  deleteForever: vi.fn(),
  emptyTrash: vi.fn(),
  restoreTemplate: vi.fn(),
  restoreVariation: vi.fn(),
}));
vi.mock("@/actions/library", () => ({
  deleteForeverAction: (...a: unknown[]) => actions.deleteForever(...a),
  emptyTrashAction: () => actions.emptyTrash(),
  restoreTemplateAction: (...a: unknown[]) => actions.restoreTemplate(...a),
}));
vi.mock("@/actions/variations", () => ({
  restoreVariationAction: (...a: unknown[]) => actions.restoreVariation(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const now = new Date("2026-11-18T12:00:00Z");
const ENTRIES = [
  {
    kind: "template" as const,
    id: "t1",
    name: "Hero dark",
    type: "custom" as const,
    template: null,
    imageUrl: null,
    deletedAt: "2026-11-17T12:00:00Z",
  },
  {
    kind: "variation" as const,
    id: "v1",
    name: "Green",
    type: "custom" as const,
    template: { id: "t2", name: "Footer" },
    imageUrl: null,
    deletedAt: "2026-10-19T13:00:00Z",
  },
];

describe("TrashList", () => {
  it("shows what each item is and when it goes", () => {
    render(<TrashList entries={ENTRIES} retentionDays={30} now={now} />);
    expect(screen.getByText(/deletes permanently in 29 days/)).toBeInTheDocument();
    expect(screen.getByText(/Variation of/)).toHaveTextContent("Footer");
    expect(screen.getByText(/deletes permanently in 1 day$/)).toBeInTheDocument();
  });

  it("restores templates and variations with the right action", async () => {
    actions.restoreTemplate.mockResolvedValue({ ok: true });
    actions.restoreVariation.mockResolvedValue({ ok: true });
    render(<TrashList entries={ENTRIES} retentionDays={30} now={now} />);
    fireEvent.click(screen.getByRole("button", { name: "Restore Green" }));
    await waitFor(() => expect(actions.restoreVariation).toHaveBeenCalledWith("v1"));
    fireEvent.click(screen.getByRole("button", { name: "Restore Hero dark" }));
    await waitFor(() => expect(actions.restoreTemplate).toHaveBeenCalledWith("t1"));
  });

  it("asks before deleting permanently, naming the item", async () => {
    actions.deleteForever.mockResolvedValue({ ok: true });
    render(<TrashList entries={ENTRIES} retentionDays={30} now={now} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Hero dark permanently" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete “Hero dark” permanently?");
    expect(actions.deleteForever).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete permanently" }));
    await waitFor(() =>
      expect(actions.deleteForever).toHaveBeenCalledWith({ kind: "template", id: "t1" }),
    );
  });

  it("empties the trash after confirming", async () => {
    actions.emptyTrash.mockResolvedValue({ ok: true });
    render(<TrashList entries={ENTRIES} retentionDays={30} now={now} />);
    fireEvent.click(screen.getByRole("button", { name: "Empty trash" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Empty the trash (2 items)?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Empty trash" }));
    await waitFor(() => expect(actions.emptyTrash).toHaveBeenCalled());
  });

  it("shows the empty state", () => {
    render(<TrashList entries={[]} retentionDays={30} now={now} />);
    expect(screen.getByText("Trash is empty")).toBeInTheDocument();
  });
});

it("daysLeft rounds up and never goes below zero", () => {
  expect(daysLeft("2026-11-18T11:00:00Z", 30, now)).toBe(30);
  expect(daysLeft("2026-01-01T00:00:00Z", 30, now)).toBe(0);
});
