import { fireEvent, render, screen, within } from "@testing-library/react";

import { HistorySheet } from "@/components/editor/history-sheet";
import type { HistoryItem } from "@/lib/db/templates";

vi.mock("@/actions/templates", () => ({ getVariationContentAction: vi.fn() }));

const item = (over: Partial<HistoryItem>): HistoryItem => ({
  id: "x",
  name: "X",
  isOriginal: false,
  parentVariationId: null,
  swatches: [],
  summary: "",
  createdAt: "2026-11-10T10:00:00Z",
  updatedAt: "2026-11-10T10:00:00Z",
  ...over,
});

const ITEMS = [
  item({ id: "o", name: "Original", isOriginal: true, updatedAt: "2026-11-18T09:00:00Z" }),
  item({
    id: "a",
    name: "Green",
    parentVariationId: "o",
    summary: "1 color changed",
    updatedAt: "2026-11-17T10:00:00Z",
  }),
  item({ id: "b", name: "Robo", parentVariationId: "a", updatedAt: "2026-11-18T08:00:00Z" }),
];

it("lists newest first with the Original last, and wires Open and Compare", () => {
  const onOpenVariation = vi.fn();
  const onCompare = vi.fn();
  render(
    <HistorySheet
      open
      onOpenChange={() => {}}
      type="custom"
      items={ITEMS}
      baseId="a"
      now={new Date("2026-11-18T10:00:00Z")}
      onOpenVariation={onOpenVariation}
      onCompare={onCompare}
    />,
  );
  const rows = within(screen.getByRole("dialog"))
    .getAllByRole("listitem")
    .filter((li) => li.parentElement?.tagName === "OL");
  expect(rows.map((r) => r.querySelector("p")?.textContent)).toEqual(["Robo", "Green", "Original"]);
  expect(rows[0]).toHaveTextContent("based on Green");
  expect(rows[1]).toHaveTextContent("1 color changed");
  expect(rows[1]).toHaveTextContent("Open now");
  // The Original's date is its creation, not its last metadata update.
  expect(rows[2]).toHaveTextContent(/created/);
  expect(screen.queryByRole("button", { name: "Open Green" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Robo" }));
  expect(onOpenVariation).toHaveBeenCalledWith("b");
  fireEvent.click(screen.getByRole("button", { name: "Compare Original with current" }));
  expect(onCompare).toHaveBeenCalledWith("o");
});
