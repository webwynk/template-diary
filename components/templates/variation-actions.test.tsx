import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { duplicateName, VariationActions } from "@/components/templates/variation-actions";

const actions = {
  rename: vi.fn(),
  trash: vi.fn(),
  restore: vi.fn(),
  usedIn: vi.fn(),
  duplicate: vi.fn(),
};
vi.mock("@/actions/variations", () => ({
  renameVariationAction: (...a: unknown[]) => actions.rename(...a),
  trashVariationAction: (...a: unknown[]) => actions.trash(...a),
  restoreVariationAction: (...a: unknown[]) => actions.restore(...a),
  setVariationUsedInAction: (...a: unknown[]) => actions.usedIn(...a),
  duplicateAsTemplateAction: (...a: unknown[]) => actions.duplicate(...a),
}));
vi.mock("@/actions/templates", () => ({ getVariationContentAction: vi.fn() }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const requestScreenshot = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/images/prepare", () => ({ requestScreenshot: () => requestScreenshot() }));

const OPTIONS = [
  { id: "o", name: "Original" },
  { id: "g", name: "Green" },
];

function renderMenu(isOriginal: boolean) {
  render(
    <VariationActions
      templateName="Hero dark"
      type="custom"
      variation={{
        id: isOriginal ? "o" : "g",
        name: isOriginal ? "Original" : "Green",
        isOriginal,
        usedIn: null,
      }}
      compareOptions={OPTIONS}
      originalId="o"
    />,
  );
}

function openMenu(name: string) {
  const trigger = screen.getByRole("button", { name: `More actions for ${name}` });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
}

beforeEach(() => {
  Object.values(actions).forEach((f) => f.mockReset());
  push.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("VariationActions", () => {
  it("offers no Rename or Move to trash for the Original", async () => {
    renderMenu(true);
    openMenu("Original");
    await screen.findByRole("menu");
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Edit “used in”", "Compare…", "Duplicate as new template"]);
  });

  it("renames a variation and shows the server's error", async () => {
    renderMenu(false);
    openMenu("Green");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const input = await screen.findByLabelText("Name");
    expect(input).toHaveValue("Green");
    actions.rename.mockResolvedValueOnce({ ok: false, error: "Name taken." });
    fireEvent.change(input, { target: { value: "Blue" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Name taken.");
    expect(actions.rename).toHaveBeenCalledWith("g", "Blue");
    actions.rename.mockResolvedValueOnce({ ok: true });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeInTheDocument());
  });

  it("moves a variation to the trash with Undo", async () => {
    actions.trash.mockResolvedValueOnce({ ok: true });
    actions.restore.mockResolvedValueOnce({ ok: true });
    renderMenu(false);
    openMenu("Green");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move to trash" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(actions.trash).toHaveBeenCalledWith("g");
    const [message, options] = toast.success.mock.calls[0]! as [
      string,
      { action: { onClick: () => void } },
    ];
    expect(message).toBe("“Green” moved to the trash");
    options.action.onClick();
    expect(actions.restore).toHaveBeenCalledWith("g");
  });

  it("duplicates as a new template and opens it", async () => {
    actions.duplicate.mockResolvedValueOnce({ ok: true, id: "new", type: "custom" });
    renderMenu(false);
    openMenu("Green");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate as new template" }));
    expect(await screen.findByLabelText("Template name")).toHaveValue("Hero dark – Green");
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/templates/new"));
    expect(actions.duplicate).toHaveBeenCalledWith("g", "Hero dark – Green");
    expect(requestScreenshot).toHaveBeenCalled();
  });
});

describe("duplicateName", () => {
  it("names copies and stays within 120 characters", () => {
    expect(duplicateName("Hero", "Original", true)).toBe("Hero copy");
    expect(duplicateName("Hero", "Green", false)).toBe("Hero – Green");
    expect(duplicateName("x".repeat(100), "y".repeat(50), false)).toHaveLength(120);
  });
});
