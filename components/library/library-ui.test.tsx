import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FavoriteButton } from "@/components/library/favorite-button";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { OptimisticItem } from "@/components/library/optimistic-row";
import { copyName } from "@/components/library/template-menu";
import { parseFilters } from "@/lib/library/filters";
import {
  clearOverride,
  resetOverrides,
  setOverride,
  settleOverride,
} from "@/lib/library/optimistic";

const setFavoriteAction = vi.fn();
vi.mock("@/actions/library", () => ({
  setFavoriteAction: (...a: unknown[]) => setFavoriteAction(...a),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("FavoriteButton", () => {
  beforeEach(() => act(() => resetOverrides()));

  it("flips at once and reports a failure", async () => {
    let resolve!: (v: unknown) => void;
    setFavoriteAction.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<FavoriteButton id="t1" name="Hero" isFavorite={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Hero to favorites" }));
    expect(
      await screen.findByRole("button", { name: "Remove Hero from favorites" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(setFavoriteAction).toHaveBeenCalledWith("t1", true);
    await act(async () => resolve({ ok: false, error: "Nope." }));
    expect(toast.error).toHaveBeenCalledWith("Nope.");
    // The server value (still false) comes back once the action settles.
    expect(screen.getByRole("button", { name: "Add Hero to favorites" })).toBeInTheDocument();
  });
});

describe("instant library feedback (speed audit P5)", () => {
  beforeEach(() => act(() => resetOverrides()));

  it("a star flips every place showing the same template, and stays after saving", async () => {
    vi.useFakeTimers();
    setFavoriteAction.mockResolvedValueOnce({ ok: true });
    render(
      <>
        <FavoriteButton id="t9" name="Card" isFavorite={false} />
        <FavoriteButton id="t9" name="Row" isFavorite={false} />
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add Card to favorites" }));
    });
    expect(screen.getByRole("button", { name: "Remove Row from favorites" })).toBeInTheDocument();
    // The override is dropped a moment later; by then the refreshed page has the real value.
    await act(async () => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("button", { name: "Add Row to favorites" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("a card disappears the moment it's trashed and comes back on Undo", () => {
    render(
      <ul>
        <OptimisticItem id="t5" as="li">
          Hero
        </OptimisticItem>
      </ul>,
    );
    act(() => setOverride("t5", { trashed: true }));
    expect(screen.queryByText("Hero")).not.toBeInTheDocument();
    act(() => clearOverride("t5", "trashed"));
    expect(screen.getByText("Hero")).toBeInTheDocument();
  });

  it("settling only clears the key it was asked to", () => {
    vi.useFakeTimers();
    render(
      <ul>
        <OptimisticItem id="t6" as="li">
          Footer
        </OptimisticItem>
      </ul>,
    );
    act(() => setOverride("t6", { trashed: true, favorite: true }));
    act(() => settleOverride("t6", "favorite", 10));
    act(() => vi.advanceTimersByTime(10));
    expect(screen.queryByText("Footer")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("LibraryToolbar", () => {
  beforeEach(() => {
    router.replace.mockReset();
    router.push.mockReset();
  });

  it("puts the search in the URL after a pause, keeping the other filters", async () => {
    vi.useFakeTimers();
    render(
      <LibraryToolbar
        filters={parseFilters({ type: "custom", sort: "name" })}
        tags={[]}
        base="/"
      />,
    );
    fireEvent.change(screen.getByLabelText("Search templates"), { target: { value: "her" } });
    fireEvent.change(screen.getByLabelText("Search templates"), { target: { value: "hero " } });
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(300));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/?q=hero&type=custom&sort=name", {
      scroll: false,
    });
    vi.useRealTimers();
  });

  it("toggles favorites with a new history entry", async () => {
    render(<LibraryToolbar filters={parseFilters({ q: "a" })} tags={[]} base="/" />);
    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/?q=a&fav=1", { scroll: false }));
  });

  it("has no Favorites toggle on the Favorites page", () => {
    render(<LibraryToolbar filters={parseFilters({})} tags={[]} base="/favorites" />);
    expect(screen.queryByRole("button", { name: /^Favorites$/ })).not.toBeInTheDocument();
  });
});

it("copyName stays within 120 characters", () => {
  expect(copyName("Hero")).toBe("Hero copy");
  expect(copyName("x".repeat(120)).length).toBeLessThanOrEqual(120);
});
