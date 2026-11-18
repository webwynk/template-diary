import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TagsManager } from "@/components/settings/tags-manager";

const createTagAction = vi.fn();
const deleteTagAction = vi.fn();
vi.mock("@/actions/tags", () => ({
  createTagAction: (...args: unknown[]) => createTagAction(...args),
  updateTagAction: vi.fn(),
  deleteTagAction: (...args: unknown[]) => deleteTagAction(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const tags = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Hero", color: "#4F46E5", templateCount: 3 },
];

describe("TagsManager", () => {
  beforeEach(() => {
    createTagAction.mockReset();
    deleteTagAction.mockReset();
  });

  it("shows an empty state when there are no tags", () => {
    render(<TagsManager tags={[]} />);
    expect(screen.getByText("No tags yet")).toBeInTheDocument();
  });

  it("validates the name before calling the server", async () => {
    render(<TagsManager tags={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a tag name.");
    expect(createTagAction).not.toHaveBeenCalled();
  });

  it("sends the trimmed name and default color, and shows server errors", async () => {
    createTagAction.mockResolvedValue({
      ok: false,
      error: "You already have a tag with this name.",
    });
    render(<TagsManager tags={[]} />);
    fireEvent.change(screen.getByLabelText("New tag"), { target: { value: "  Hero " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(createTagAction).toHaveBeenCalledWith({ name: "Hero", color: "#64748B" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You already have a tag with this name.",
    );
  });

  it("asks before deleting and says how many templates are affected", async () => {
    deleteTagAction.mockResolvedValue({ ok: true });
    render(<TagsManager tags={tags} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Hero" }));
    expect(await screen.findByText(/removed from 3 templates/)).toBeInTheDocument();
    expect(deleteTagAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));
    await waitFor(() => expect(deleteTagAction).toHaveBeenCalledWith({ id: tags[0]!.id }));
  });
});
