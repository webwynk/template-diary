import {
  formatLike,
  isNamedColor,
  parseColor,
  parseTarget,
  replacementFor,
} from "@/lib/engine/colors";

describe("parseColor", () => {
  it.each([
    ["#4F46E5", "#4f46e5", 1, "hex6"],
    ["#fff", "#ffffff", 1, "hex3"],
    ["#ffff", "#ffffff", 1, "hex4"],
    ["#4f46e580", "#4f46e5", 0.502, "hex8"],
    ["rgb(79, 70, 229)", "#4f46e5", 1, "rgb"],
    ["rgba(79,70,229,.5)", "#4f46e5", 0.5, "rgb"],
    ["rgb(79 70 229 / 50%)", "#4f46e5", 0.5, "rgb-modern"],
    ["hsl(243, 75%, 59%)", "#5048e5", 1, "hsl"],
    ["hsla(0, 100%, 50%, 0.25)", "#ff0000", 0.25, "hsl"],
    ["hsl(0 100% 50%)", "#ff0000", 1, "hsl-modern"],
    ["white", "#ffffff", 1, "named"],
    ["RebeccaPurple", "#663399", 1, "named"],
    ["hwb(0 0% 0%)", "#ff0000", 1, "other"],
  ])("%s", (raw, rgb, alpha, format) => {
    const parsed = parseColor(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.rgb).toBe(rgb);
    expect(parsed!.alpha).toBeCloseTo(alpha, 2);
    expect(parsed!.format).toBe(format);
  });

  it.each([
    "transparent",
    "currentColor",
    "inherit",
    "#ggg",
    "#12",
    "rgb(var(--r), 0, 0)",
    "hello",
    "",
    "url(x)",
  ])("ignores %s", (raw) => {
    expect(parseColor(raw)).toBeNull();
  });

  it("knows named colors but not keywords", () => {
    expect(isNamedColor("Red")).toBe(true);
    expect(isNamedColor("transparent")).toBe(false);
    expect(isNamedColor("bold")).toBe(false);
  });
});

describe("parseTarget", () => {
  it("accepts 6 and 8 digit hex only", () => {
    expect(parseTarget("#ABCDEF")).toEqual({ rgb: "#abcdef", alpha: null });
    expect(parseTarget("#00000080")?.alpha).toBeCloseTo(0.502, 2);
    expect(parseTarget("#fff")).toBeNull();
    expect(parseTarget("red")).toBeNull();
  });
});

describe("formatLike", () => {
  it.each([
    ["#FFF", "hex3", "#000000", 1, "#000"],
    ["#fff", "hex3", "#123456", 1, "#123456"],
    ["#4F46E5", "hex6", "#16a34a", 1, "#16A34A"],
    ["#4f46e5", "hex6", "#16a34a", 0.5, "#16a34a80"],
    ["#ffff", "hex4", "#000000", 1, "#000"],
    ["rgb(1, 2, 3)", "rgb", "#16a34a", 1, "rgb(22, 163, 74)"],
    ["rgba(1,2,3,.5)", "rgb", "#16a34a", 0.5, "rgba(22,163,74,0.5)"],
    ["rgb(1, 2, 3)", "rgb", "#16a34a", 0.25, "rgba(22, 163, 74, 0.25)"],
    ["rgb(1 2 3 / .5)", "rgb-modern", "#16a34a", 0.5, "rgb(22 163 74 / 0.5)"],
    ["rgb(1 2 3)", "rgb-modern", "#16a34a", 1, "rgb(22 163 74)"],
    ["hsl(0, 100%, 50%)", "hsl", "#00ff00", 1, "hsl(120, 100%, 50%)"],
    ["hsla(0,100%,50%,.3)", "hsl", "#00ff00", 0.3, "hsla(120,100%,50%,0.3)"],
    ["hsl(0 100% 50%)", "hsl-modern", "#0000ff", 0.5, "hsl(240 100% 50% / 0.5)"],
    ["hsl(0 100% 50%)", "hsl-modern", "#0000ff", 1, "hsl(240 100% 50%)"],
    ["red", "named", "#16a34a", 1, "#16a34a"],
    ["red", "named", "#16a34a", 0.5, "rgba(22, 163, 74, 0.5)"],
    ["hwb(0 0% 0%)", "other", "#16a34a", 1, "#16a34a"],
  ] as const)("%s (%s) → %s @%s = %s", (original, format, rgb, alpha, expected) => {
    expect(formatLike(original, format, rgb, alpha)).toBe(expected);
  });
});

describe("replacementFor", () => {
  it("keeps an occurrence's own transparency", () => {
    expect(
      replacementFor({ raw: "rgba(79,70,229,.2)", format: "rgb", alpha: 0.2 }, "#16a34a"),
    ).toBe("rgba(22,163,74,0.2)");
    expect(
      replacementFor({ raw: "rgba(79,70,229,.2)", format: "rgb", alpha: 0.2 }, "#16a34a80"),
    ).toBe("rgba(22,163,74,0.2)");
  });

  it("applies the target alpha to opaque occurrences", () => {
    expect(replacementFor({ raw: "#4f46e5", format: "hex6", alpha: 1 }, "#16a34a80")).toBe(
      "#16a34a80",
    );
  });

  it("rejects an invalid target", () => {
    expect(() => replacementFor({ raw: "#fff", format: "hex3", alpha: 1 }, "green")).toThrow();
  });
});
