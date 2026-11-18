import { changesSummary } from "@/lib/templates/changes";

describe("changesSummary", () => {
  it("summarizes colors, images, fonts and code edits", () => {
    expect(
      changesSummary([
        { kind: "color", from: "#4f46e5", to: "#10b981", count: 3 },
        { kind: "color", from: "#ffffff", to: "#000000", count: 1 },
        { kind: "image", from: "a.png", to: "b.png", count: 1 },
        { kind: "code" },
      ]),
    ).toBe("2 colors and 1 image changed, code edited");
  });

  it("counts a value changed again in a later save once", () => {
    expect(
      changesSummary([
        { kind: "color", from: "#4F46E5", to: "#10b981", count: 1 },
        { kind: "color", from: "#4f46e5", to: "#ef4444", count: 1 },
        { kind: "font", from: "Inter", to: "Lato", count: 1 },
      ]),
    ).toBe("1 color and 1 font changed");
  });

  it("is empty for no changes and ignores malformed data", () => {
    expect(changesSummary([])).toBe("");
    expect(changesSummary(null)).toBe("");
    expect(changesSummary({ kind: "color" })).toBe("");
    expect(changesSummary([1, "x", null, [], { kind: "other" }])).toBe("");
    expect(changesSummary([{ kind: "code" }])).toBe("Code edited");
  });
});
