import { render, screen } from "@testing-library/react";

import { Sidebar } from "@/components/shell/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings/tags" }));
vi.mock("@/actions/auth", () => ({ signOut: vi.fn() }));

const tags = [
  { id: "t1", name: "Hero", color: "#4F46E5", templateCount: 12 },
  { id: "t2", name: "Pricing", color: "#16A34A", templateCount: 0 },
];

function renderSidebar(variant: "full" | "rail") {
  return render(
    <TooltipProvider>
      <Sidebar email="owner@example.com" tags={tags} variant={variant} />
    </TooltipProvider>,
  );
}

describe("Sidebar", () => {
  it("marks the current section and lists tags with counts", () => {
    renderSidebar("full");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Library" })).not.toHaveAttribute("aria-current");
    const hero = screen.getByRole("link", { name: /Hero/ });
    expect(hero).toHaveAttribute("href", "/?tag=t1");
    expect(hero).toHaveTextContent("12");
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
  });

  it("rail keeps every link reachable by name and hides the tag list", () => {
    renderSidebar("rail");
    for (const name of ["Library", "Favorites", "Palettes", "Trash", "Settings", "Sign out"]) {
      expect(screen.getByRole(name === "Sign out" ? "button" : "link", { name })).toBeVisible();
    }
    expect(screen.queryByText("Hero")).not.toBeInTheDocument();
  });

  it("shows a hint when there are no tags", () => {
    render(
      <TooltipProvider>
        <Sidebar email="owner@example.com" tags={[]} variant="full" />
      </TooltipProvider>,
    );
    expect(screen.getByText("No tags yet.")).toBeInTheDocument();
  });
});
