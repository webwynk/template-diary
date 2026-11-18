import { currentColors, parsePresetColors, suggestMapping } from "@/lib/presets";
import { presetInputSchema } from "@/lib/validation/presets";

describe("suggestMapping", () => {
  it("maps the most used color to the first preset color, and keeps the extras", () => {
    expect(
      suggestMapping(
        ["#111111", "#222222", "#333333"],
        [
          { hex: "#aaaaaa", label: "Primary" },
          { hex: "#bbbbbb", label: null },
        ],
      ),
    ).toEqual({ "#111111": "#aaaaaa", "#222222": "#bbbbbb", "#333333": null });
    expect(suggestMapping([], [{ hex: "#aaaaaa", label: null }])).toEqual({});
  });
});

describe("currentColors", () => {
  it("uses the new color where one is set, keeps the order and lists each color once", () => {
    expect(
      currentColors(["#111111", "#222222", "#333333"], {
        "#111111": "#333333",
        "#222222": "#ABCDEF",
      }),
    ).toEqual(["#333333", "#abcdef"]);
  });

  it("stops at 32 colors", () => {
    const many = Array.from({ length: 40 }, (_, i) => `#0000${i.toString(16).padStart(2, "0")}`);
    expect(currentColors(many, {})).toHaveLength(32);
  });
});

describe("parsePresetColors", () => {
  it("reads stored colors and skips anything malformed", () => {
    expect(
      parsePresetColors([
        { hex: "#4f46e5", label: "Primary" },
        { hex: "#000000", label: "" },
        1,
        null,
        {},
      ]),
    ).toEqual([
      { hex: "#4f46e5", label: "Primary" },
      { hex: "#000000", label: null },
    ]);
    expect(parsePresetColors(null)).toEqual([]);
  });
});

describe("presetInputSchema (mirrors the database check)", () => {
  it("normalizes hex values and trims names and labels", () => {
    const r = presetInputSchema.parse({
      name: "  Robo ",
      colors: [
        { hex: "4F46E5", label: "  Primary " },
        { hex: "#fff", label: "" },
        { hex: "#0f172aff" },
        { hex: "#0f172a80", label: null },
      ],
    });
    expect(r).toEqual({
      name: "Robo",
      colors: [
        { hex: "#4f46e5", label: "Primary" },
        { hex: "#ffffff", label: null },
        { hex: "#0f172a", label: null },
        { hex: "#0f172a80", label: null },
      ],
    });
  });

  it("refuses bad colors, empty and oversized palettes", () => {
    const bad = (input: unknown) => presetInputSchema.safeParse(input).success;
    expect(bad({ name: "A", colors: [{ hex: "red" }] })).toBe(false);
    expect(bad({ name: "A", colors: [] })).toBe(false);
    expect(bad({ name: " ", colors: [{ hex: "#fff" }] })).toBe(false);
    expect(bad({ name: "x".repeat(61), colors: [{ hex: "#fff" }] })).toBe(false);
    expect(bad({ name: "A", colors: [{ hex: "#fff", label: "x".repeat(41) }] })).toBe(false);
    expect(bad({ name: "A", colors: Array.from({ length: 33 }, () => ({ hex: "#fff" })) })).toBe(
      false,
    );
  });
});
