import { applySwaps, detect, MAX_CONTENT_BYTES, summarize, SUMMARY_MAX_COLORS } from "@/lib/engine";
import {
  googleFamilyParam,
  googleFontFamilies,
  isValidFontName,
  quoteFamily,
} from "@/lib/engine/fonts";
import { lineAt, lineStarts, snippetAt } from "@/lib/engine/text";

import { fixture } from "./helpers";

describe("summarize", () => {
  it("builds the small summary cached in variations.detected", () => {
    const summary = summarize(detect(fixture("fonts.html"), "custom"));
    expect(summary).toEqual({
      v: 1,
      colors: [],
      colorCount: 0,
      imageCount: 0,
      fonts: ["Open Sans", "Roboto Slab", "Lato", "Poppins"],
      warningCount: 0,
    });
    const colors = summarize(detect(fixture("colors.html"), "custom"));
    expect(colors.colors[0]).toEqual({ rgb: "#4f46e5", count: 8 });
    expect(colors.colorCount).toBe(5);
    expect(summarize(detect(fixture("images.html"), "custom")).imageCount).toBe(10);
  });

  it("caps the number of swatches", () => {
    const css = Array.from(
      { length: 20 },
      (_, i) => `.c${i}{color:#0000${i.toString(16).padStart(2, "0")}}`,
    ).join("");
    const summary = summarize(detect(`<style>${css}</style>`, "custom"));
    expect(summary.colors).toHaveLength(SUMMARY_MAX_COLORS);
    expect(summary.colorCount).toBe(20);
  });
});

describe("size limit", () => {
  it("rejects content over 5 MB, counting bytes not characters", () => {
    const justUnder = "é".repeat(MAX_CONTENT_BYTES / 2);
    expect(() => detect(justUnder, "custom")).not.toThrow();
    expect(() => detect(`${justUnder}x`, "custom")).toThrow(/5 MB/);
    expect(() => applySwaps(`${justUnder}x`, "custom", [])).toThrow(/5 MB/);
  });

  it("rejects a swap result that would grow past 5 MB", () => {
    const filler = "a".repeat(MAX_CONTENT_BYTES - 40);
    const html = `<img src="https://a.test/x.jpg">${filler}`;
    expect(() =>
      applySwaps(html, "custom", [
        {
          kind: "image",
          fromUrl: "https://a.test/x.jpg",
          to: `https://a.test/${"y".repeat(60)}.jpg`,
        },
      ]),
    ).toThrow(/5 MB/);
  });
});

describe("font helpers", () => {
  it("validates font names", () => {
    expect(isValidFontName("Open Sans")).toBe(true);
    expect(isValidFontName("Source Sans 3")).toBe(true);
    expect(isValidFontName("Font'; x")).toBe(false);
    expect(isValidFontName("")).toBe(false);
  });

  it("reads Google Fonts URLs (css2, v1 with pipes, &amp;)", () => {
    const url =
      "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400&family=Inter&display=swap";
    expect(googleFontFamilies(url)).toEqual([
      { family: "Open Sans", raw: "Open+Sans", offset: url.indexOf("Open+Sans") },
      { family: "Inter", raw: "Inter", offset: url.indexOf("Inter") },
    ]);
    expect(
      googleFontFamilies("//fonts.googleapis.com/css?family=Lato|Open+Sans:400").map(
        (f) => f.family,
      ),
    ).toEqual(["Lato", "Open Sans"]);
    expect(
      googleFontFamilies("https://fonts.googleapis.com/css2?family=A&amp;family=B%20C").map(
        (f) => f.family,
      ),
    ).toEqual(["A", "B C"]);
    expect(googleFontFamilies("https://example.com/css2?family=Inter")).toEqual([]);
    expect(googleFontFamilies("https://fonts.googleapis.com/css2?family=&display=swap")).toEqual(
      [],
    );
  });

  it("formats names for URLs and CSS", () => {
    expect(googleFamilyParam(" Open  Sans ")).toBe("Open+Sans");
    expect(quoteFamily("Inter", "Roboto")).toBe("Inter");
    expect(quoteFamily("Open Sans", "Roboto")).toBe('"Open Sans"');
    expect(quoteFamily("3D Font", "Roboto")).toBe('"3D Font"');
    expect(quoteFamily("Inter", "'Roboto'")).toBe("'Inter'");
    expect(quoteFamily("Open Sans", "Roboto", '"')).toBe("'Open Sans'");
    expect(quoteFamily("Open Sans", '"Roboto"', '"')).toBe("'Open Sans'");
    expect(quoteFamily("Open Sans", "'Roboto'", "'")).toBe('"Open Sans"');
  });
});

describe("text helpers", () => {
  it("maps offsets to lines and builds snippets", () => {
    const text = "one\ntwo\nthree";
    const starts = lineStarts(text);
    expect(starts).toEqual([0, 4, 8]);
    expect([0, 3, 4, 8, 12].map((o) => lineAt(starts, o))).toEqual([1, 1, 2, 3, 3]);
    expect(snippetAt(text, 4, 7, 2)).toBe("…e two t…");
    expect(snippetAt("abc", 0, 3)).toBe("abc");
  });
});
