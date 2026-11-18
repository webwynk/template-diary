import { applySwaps, detect, type Detection, EngineError, type Swap } from "@/lib/engine";
import { applyEdits } from "@/lib/engine/custom/apply";

import { compact, fixture, untouchable } from "./helpers";

const CUSTOM_FIXTURES = [
  "colors.html",
  "script-text.html",
  "vars-svg.html",
  "images.html",
  "fonts.html",
];

function group(d: Detection, rgb: string) {
  return d.colors.find((g) => g.rgb === rgb);
}

describe.each(CUSTOM_FIXTURES)("custom fixture %s", (name) => {
  const html = fixture(name);
  const detection = detect(html, "custom");

  it("matches the detection snapshot", () => {
    expect(compact(detection)).toMatchSnapshot();
  });

  it("every occurrence points at its exact source text", () => {
    const all = [
      ...detection.colors.flatMap((g) =>
        g.occurrences.map((o) => ({ loc: o.location, raw: o.raw })),
      ),
      ...detection.images.map((o) => ({ loc: o.location, raw: o.url })),
      ...detection.fonts.map((o) => ({ loc: o.location, raw: o.raw })),
    ];
    for (const { loc, raw } of all) {
      expect(loc.kind).toBe("range");
      if (loc.kind === "range") expect(html.slice(loc.start, loc.end)).toBe(raw);
    }
  });

  it("returns the content byte for byte when there are no swaps", () => {
    expect(applySwaps(html, "custom", [])).toEqual({ content: html, applied: [] });
  });

  it("swapping everything never touches scripts, text or comments", () => {
    const swaps: Swap[] = [
      ...detection.colors.map((g, i): Swap => ({
        kind: "color",
        fromRgb: g.rgb,
        to: `#0${i}${i}a0b`,
      })),
      ...[...new Set(detection.images.map((i) => i.url))].map((url, i): Swap => ({
        kind: "image",
        fromUrl: url,
        to: `https://new.test/${i}.jpg`,
      })),
      ...[...new Set(detection.fonts.map((f) => f.family.toLowerCase()))].map(
        (family, i): Swap => ({
          kind: "font",
          fromFamily: family,
          to: `New Font ${String.fromCharCode(65 + i)}`,
        }),
      ),
    ];
    const result = applySwaps(html, "custom", swaps);
    expect(untouchable(result.content)).toEqual(untouchable(html));

    // apply → detect round trip: nothing of the old values is left, the new ones are all found.
    const after = detect(result.content, "custom");
    for (const g of detection.colors) expect(group(after, g.rgb)).toBeUndefined();
    expect(after.colors.reduce((n, g) => n + g.count, 0)).toBe(
      detection.colors.reduce((n, g) => n + g.count, 0),
    );
    expect(after.images).toHaveLength(detection.images.length);
    expect(after.fonts).toHaveLength(detection.fonts.length);
    expect(after.images.every((i) => i.url.startsWith("https://new.test/"))).toBe(true);
    expect(after.fonts.every((f) => f.family.startsWith("New Font"))).toBe(true);
    expect(result.applied.reduce((n, a) => n + a.count, 0)).toBe(
      detection.colors.reduce((n, g) => n + g.count, 0) +
        detection.images.length +
        detection.fonts.length,
    );
  });
});

describe("custom color swaps", () => {
  const html = fixture("colors.html");

  it("keeps each occurrence's format, case and alpha", () => {
    const { content, applied } = applySwaps(html, "custom", [
      { kind: "color", fromRgb: "#4f46e5", to: "#10b981" },
    ]);
    expect(applied).toEqual([{ kind: "color", from: "#4f46e5", to: "#10b981", count: 8 }]);
    expect(content).toContain(".a { color: #10b981; }");
    expect(content).toContain(".b { color: #10B981 !important; }");
    expect(content).toContain("background-color: rgb(16, 185, 129);");
    expect(content).toContain("border: 1px solid rgba(16,185,129,0.5);");
    expect(content).toContain("outline-color: rgb(16 185 129 / 0.25);");
    expect(content).toContain(".f { color: hsl(160, 84%, 39%); }");
    expect(content).toContain("linear-gradient(135deg, #10b981 0%, #ec4899 50%");
    expect(content).toContain('style="background:#10b981;color:white"');
    // Text, comments and the other colors are untouched.
    expect(content).toContain("<p>red, #4f46e5 and rgb(1,2,3) in text stay as they are.</p>");
    expect(content).toContain("<!-- a comment with #4f46e5 -->");
    expect(content).toContain('content: "red #ff0000"');
  });

  it("changes nothing outside the swapped occurrences", () => {
    const { content } = applySwaps(html, "custom", [
      { kind: "color", fromRgb: "#ec4899", to: "#000000" },
    ]);
    const expected = html
      .replace("#ec4899 50%", "#000000 50%")
      .replace("rgba(236, 72, 153, .2)", "rgba(0, 0, 0, 0.2)")
      .replace(".a { color: #ec4899; }", ".a { color: #000000; }");
    expect(content).toBe(expected);
  });

  it("writes named colors as hex and handles alpha targets", () => {
    const { content } = applySwaps(html, "custom", [
      { kind: "color", fromRgb: "#ffffff", to: "#11223380" },
      { kind: "color", fromRgb: "#000000", to: "#ff0000" },
    ]);
    expect(content).toContain(".g { color: #11223380; background: #11223380; }");
    expect(content).toContain(".h { color: #ff000080; box-shadow: 0 1px 2px #f003; }");
    expect(content).toContain(".i { color: rgba(17, 34, 51, 0.502); background: #ff0000; }");
    expect(content).toContain('style="background:#4f46e5;color:rgba(17, 34, 51, 0.502)"');
  });

  it("skips excluded occurrences", () => {
    const d = detect(html, "custom");
    const occ = group(d, "#4f46e5")?.occurrences ?? [];
    const keep = occ.filter((o) => o.context === "style-attr").map((o) => o.id);
    const { content, applied } = applySwaps(html, "custom", [
      { kind: "color", fromRgb: "#4F46E5", to: "#10b981", excludeIds: keep },
    ]);
    expect(applied[0]?.count).toBe(7);
    expect(content).toContain('style="background:#4f46e5;color:white"');
    expect(group(detect(content, "custom"), "#4f46e5")?.count).toBe(1);
  });

  it("ignores swaps that match nothing or change nothing", () => {
    const result = applySwaps(html, "custom", [
      { kind: "color", fromRgb: "#123456", to: "#000000" },
      { kind: "color", fromRgb: "#ec4899", to: "#EC4899" },
    ]);
    expect(result.applied).toEqual([{ kind: "color", from: "#ec4899", to: "#EC4899", count: 1 }]);
    expect(result.content).toBe(html.replace("rgba(236, 72, 153, .2)", "rgba(236, 72, 153, 0.2)"));
  });

  it("updates CSS variable definitions but not var() usages", () => {
    const src = fixture("vars-svg.html");
    const { content } = applySwaps(src, "custom", [
      { kind: "color", fromRgb: "#4f46e5", to: "#0ea5e9" },
    ]);
    expect(content).toContain("--brand: #0EA5E9;");
    expect(content).toContain("--brand-soft: rgba(14, 165, 233, 0.1);");
    expect(content).toContain("color: var(--brand);");
    expect(content).toContain('<svg viewBox="0 0 10 10" fill="#0ea5e9">');
    expect(content).toContain("stop-color='rgb(14,165,233)'");
    expect(content).toContain('stroke="  #0ea5e9  "');
    expect(content).toContain('<div fill="#4f46e5" stroke="#4f46e5">not svg, ignored</div>');
  });

  it("never edits colors inside <script>, text, textarea or JSON-LD", () => {
    const src = fixture("script-text.html");
    const { content } = applySwaps(src, "custom", [
      { kind: "color", fromRgb: "#333333", to: "#ff0000" },
    ]);
    expect(content).toContain("body{color:#f00;background:#fafafa}");
    expect(content).toContain('<p style="color: #f00">#333 is a nice grey</p>');
    expect(content).toContain("<textarea>.y { color: #333 }</textarea>");
    expect(content).toContain('<template><div style="color:#f00"></div></template>');
    const scripts = (s: string) => s.match(/<script[\s\S]*?<\/script>/g);
    expect(scripts(content)).toEqual(scripts(src));
  });
});

describe("custom image swaps", () => {
  const html = fixture("images.html");

  it("replaces every use of a URL (src, srcset, url() quoted and unquoted, preload, style attr)", () => {
    const { content, applied } = applySwaps(html, "custom", [
      {
        kind: "image",
        fromUrl: "https://cdn.example.com/hero.jpg",
        to: "https://img.test/new-hero.jpg?w=1200&q=80",
      },
      { kind: "image", fromUrl: "https://cdn.example.com/a.jpg", to: "https://img.test/a.jpg" },
      {
        kind: "image",
        fromUrl: "https://cdn.example.com/band.png",
        to: "https://img.test/band.png",
      },
    ]);
    expect(applied.map((a) => a.count)).toEqual([3, 3, 1]);
    expect(content).toContain('url("https://img.test/new-hero.jpg?w=1200&q=80") center/cover');
    expect(content).toContain('href="https://img.test/new-hero.jpg?w=1200&q=80"');
    expect(content).toContain("url('https://img.test/new-hero.jpg?w=1200&q=80')");
    expect(content).toContain("url(https://img.test/band.png), url('img/local.png')");
    expect(content).toContain(
      'srcset="https://img.test/a.jpg 1x, https://cdn.example.com/a@2x.jpg 2x"',
    );
    expect(content).toContain('<script>const img = "https://cdn.example.com/a.jpg";</script>');
    expect(content).toContain("src: url(https://cdn.example.com/brand.woff2)");
  });

  it("replaces unquoted attributes and srcset with w descriptors", () => {
    const { content } = applySwaps(html, "custom", [
      { kind: "image", fromUrl: "https://cdn.example.com/b.jpg", to: "https://img.test/b.jpg" },
      {
        kind: "image",
        fromUrl: "https://cdn.example.com/b-960.webp",
        to: "https://img.test/b.webp",
      },
      {
        kind: "image",
        fromUrl: "data:image/png;base64,iVBORw0KGgo=",
        to: "https://img.test/dot.png",
      },
    ]);
    expect(content).toContain("<img src=https://img.test/b.jpg alt");
    expect(content).toContain("480w,https://img.test/b.webp 960w");
    expect(content).toContain(".dot { background: url(https://img.test/dot.png); }");
  });

  it.each([
    ["javascript:void", /http/],
    ["ftp://x.test/a.jpg", /http/],
    ["https://x.test/a b.jpg", /spaces/],
    ['https://x.test/a".jpg', /quotes/],
    ["https://x.test/a).jpg", /brackets/],
    ["https://x.test/<b>.jpg", /brackets/],
    ["https://x.test\\a.jpg", /backslashes/],
    ["", /Paste/],
  ])("rejects the unsafe link %s", (to, message) => {
    expect(() =>
      applySwaps(html, "custom", [{ kind: "image", fromUrl: "https://cdn.example.com/a.jpg", to }]),
    ).toThrow(message);
  });

  it("rejects commas when the URL is used in a srcset", () => {
    expect(() =>
      applySwaps(html, "custom", [
        { kind: "image", fromUrl: "https://cdn.example.com/a.jpg", to: "https://x.test/a,b.jpg" },
      ]),
    ).toThrow(/commas/);
    // Fine when the URL only appears outside srcset.
    expect(
      applySwaps(html, "custom", [
        { kind: "image", fromUrl: "https://cdn.example.com/b.jpg", to: "https://x.test/a,b.jpg" },
      ]).applied[0]?.count,
    ).toBe(1);
  });
});

describe("custom font swaps", () => {
  const html = fixture("fonts.html");

  it("rewrites the Google Fonts URL and every matching font-family", () => {
    const { content, applied } = applySwaps(html, "custom", [
      { kind: "font", fromFamily: "Open Sans", to: "Source Sans 3" },
      { kind: "font", fromFamily: "roboto slab", to: "Merriweather" },
      { kind: "font", fromFamily: "Poppins", to: "DM Sans" },
    ]);
    expect(applied).toEqual([
      { kind: "font", from: "Open Sans", to: "Source Sans 3", count: 3 },
      { kind: "font", from: "roboto slab", to: "Merriweather", count: 3 },
      { kind: "font", from: "Poppins", to: "DM Sans", count: 2 },
    ]);
    expect(content).toContain(
      "css2?family=Source+Sans+3:wght@400;700&amp;family=Merriweather:wght@600&display=swap",
    );
    expect(content).toContain("css?family=Lato:400,700|DM+Sans');");
    expect(content).toContain('body { font-family: "Source Sans 3", Arial, sans-serif; }');
    expect(content).toContain("h1 { font-family: 'Merriweather', serif; }");
    expect(content).toContain("h2 { font: italic 700 2rem/1.2 Merriweather, serif; }");
    expect(content).toContain(`<p style="font-family: 'Source Sans 3', sans-serif">`);
    expect(content).toContain(`<p style='font-family: "DM Sans"'>`);
  });

  it("quotes new names that need it, without breaking the attribute", () => {
    const { content } = applySwaps(html, "custom", [
      { kind: "font", fromFamily: "Lato", to: "Work Sans" },
    ]);
    expect(content).toContain('.lato { font-family: "Work Sans"; }');
    expect(content).toContain("css?family=Work+Sans:400,700|Poppins");
    const attr = applySwaps('<p style="font-family: Lato">x</p>', "custom", [
      { kind: "font", fromFamily: "Lato", to: "Work Sans" },
    ]);
    expect(attr.content).toBe(`<p style="font-family: 'Work Sans'">x</p>`);
  });

  it("rejects font names with unsafe characters", () => {
    expect(() =>
      applySwaps(html, "custom", [{ kind: "font", fromFamily: "Lato", to: "Evil'; }" }]),
    ).toThrow(EngineError);
  });
});

describe("swap validation", () => {
  const html = fixture("colors.html");

  it("rejects bad target colors and duplicate swaps", () => {
    expect(() =>
      applySwaps(html, "custom", [{ kind: "color", fromRgb: "#4f46e5", to: "red" }]),
    ).toThrow(/Pick a color/);
    expect(() =>
      applySwaps(html, "custom", [{ kind: "color", fromRgb: "blue", to: "#000000" }]),
    ).toThrow(EngineError);
    expect(() =>
      applySwaps(html, "custom", [
        { kind: "color", fromRgb: "#4f46e5", to: "#000000" },
        { kind: "color", fromRgb: "#4F46E5", to: "#ffffff" },
      ]),
    ).toThrow(/twice/);
  });
});

describe("applyEdits safety", () => {
  it("applies from the end so offsets stay valid", () => {
    expect(
      applyEdits("aaa bbb ccc", [
        { start: 0, end: 3, raw: "aaa", text: "X" },
        { start: 8, end: 11, raw: "ccc", text: "ZZZZ" },
      ]),
    ).toBe("X bbb ZZZZ");
  });

  it("aborts when the text at an offset isn't what was detected", () => {
    expect(() => applyEdits("aaa bbb", [{ start: 4, end: 7, raw: "ccc", text: "x" }])).toThrow(
      /Nothing was changed/,
    );
  });

  it("aborts on overlapping edits", () => {
    expect(() =>
      applyEdits("abcdef", [
        { start: 0, end: 3, raw: "abc", text: "x" },
        { start: 2, end: 4, raw: "cd", text: "y" },
      ]),
    ).toThrow(/overlap/);
  });
});

describe("custom detection edge cases", () => {
  it("recovers from broken CSS the way a browser does", () => {
    const html =
      "<style>.a{color:#fff</style><style>.b{ color: #000 }}} .c{color:#abc}</style><p style='color:red;;'>x</p>";
    const d = detect(html, "custom");
    expect(d.colors.map((g) => g.rgb).sort()).toEqual(["#000000", "#aabbcc", "#ff0000", "#ffffff"]);
    for (const occ of d.colors.flatMap((g) => g.occurrences)) {
      if (occ.location.kind === "range")
        expect(html.slice(occ.location.start, occ.location.end)).toBe(occ.raw);
    }
    const { content } = applySwaps(html, "custom", [
      { kind: "color", fromRgb: "#000000", to: "#111111" },
    ]);
    expect(content).toBe(html.replace("#000", "#111"));
  });

  it("handles empty content, fragments and full documents", () => {
    expect(detect("", "custom")).toEqual({ colors: [], images: [], fonts: [], warnings: [] });
    expect(detect("<div style='color:#abc'></div>", "custom").colors[0]?.rgb).toBe("#aabbcc");
    expect(
      detect("<!doctype html><html><head><style>a{color:#abc}</style></head></html>", "custom")
        .colors[0]?.count,
    ).toBe(1);
  });

  it("reports line numbers", () => {
    const d = detect("<style>\n\n a { color: #abc }\n</style>", "custom");
    const loc = d.colors[0]?.occurrences[0]?.location;
    expect(loc?.kind === "range" && loc.line).toBe(3);
  });
});
