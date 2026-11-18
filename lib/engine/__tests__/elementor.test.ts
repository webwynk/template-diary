import { applySwaps, detect, EngineError, type Swap } from "@/lib/engine";
import { encodeJsonString, locateTokens, pathKey } from "@/lib/engine/elementor/json-locate";

import { compact, fixture } from "./helpers";

const SECTION = fixture("elementor-section.json");
const PAGE = fixture("elementor-page.json");

describe.each([
  ["elementor-section.json", SECTION],
  ["elementor-page.json", PAGE],
])("elementor fixture %s", (_name, json) => {
  const detection = detect(json, "elementor");

  it("matches the detection snapshot", () => {
    expect(compact(detection)).toMatchSnapshot();
  });

  it("returns the file byte for byte when there are no swaps", () => {
    expect(applySwaps(json, "elementor", []).content).toBe(json);
  });

  it("swapping everything changes only the swapped values", () => {
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
      ...[...new Set(detection.fonts.map((f) => f.family))].map((family, i): Swap => ({
        kind: "font",
        fromFamily: family,
        to: `New Font ${String.fromCharCode(65 + i)}`,
      })),
    ];
    const { content } = applySwaps(json, "elementor", swaps);
    const before = JSON.parse(json) as unknown;
    const after = JSON.parse(content) as unknown;

    // Every changed leaf must be one of the detected paths (or an image's id).
    const allowed = new Set<string>([
      ...detection.colors.flatMap((g) =>
        g.occurrences.map((o) => (o.location.kind === "path" ? pathKey(o.location.path) : "")),
      ),
      ...detection.fonts.map((o) => (o.location.kind === "path" ? pathKey(o.location.path) : "")),
      ...detection.images.flatMap((o) =>
        o.location.kind === "path"
          ? [pathKey([...o.location.path, "url"]), pathKey([...o.location.path, "id"])]
          : [],
      ),
    ]);
    const changed: string[] = [];
    const diff = (a: unknown, b: unknown, path: (string | number)[]) => {
      if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
        expect(Object.keys(b)).toEqual(Object.keys(a)); // same keys, same order
        for (const k of Object.keys(a)) {
          const key = Array.isArray(a) ? Number(k) : k;
          diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], [
            ...path,
            key,
          ]);
        }
      } else if (a !== b) changed.push(pathKey(path));
    };
    diff(before, after, []);
    expect(changed.length).toBeGreaterThan(0);
    for (const p of changed) expect(allowed).toContain(p);

    // And the new values are what detection finds next time.
    const again = detect(content, "elementor");
    expect(again.images.every((i) => i.url.startsWith("https://new.test/"))).toBe(true);
    expect(again.fonts.every((f) => f.family.startsWith("New Font"))).toBe(true);
    for (const g of detection.colors)
      expect(again.colors.find((x) => x.rgb === g.rgb)).toBeUndefined();
  });
});

describe("elementor swaps", () => {
  it("keeps the compact format and \\/ escapes, and only touches the swapped values", () => {
    const { content, applied } = applySwaps(SECTION, "elementor", [
      { kind: "color", fromRgb: "#4f46e5", to: "#10b981" },
    ]);
    expect(applied).toEqual([{ kind: "color", from: "#4f46e5", to: "#10b981", count: 4 }]);
    const expected = SECTION.replace('"background_color":"#4F46E5"', '"background_color":"#10B981"')
      .replace('"rgba(79, 70, 229, 0.1)"', '"rgba(16, 185, 129, 0.1)"')
      .replace('"title_color":"#4F46E5"', '"title_color":"#10B981"')
      .replace('"background_color":"#4f46e5"', '"background_color":"#10b981"');
    expect(content).toBe(expected);
    // The heading text that happens to contain the color is not a color setting.
    expect(content).toContain('"title":"Red heading #4F46E5"');
  });

  it("replaces image URLs and clears the old media id (gallery, repeaters, backgrounds)", () => {
    const { content, applied } = applySwaps(SECTION, "elementor", [
      {
        kind: "image",
        fromUrl: "https://site.test/wp-content/uploads/2024/01/hero.jpg",
        to: "https://img.test/hero.jpg",
      },
      {
        kind: "image",
        fromUrl: "https://site.test/wp-content/uploads/g2.jpg",
        to: "https://img.test/g2.jpg",
      },
      { kind: "image", fromUrl: "https://site.test/s1.jpg", to: "https://img.test/s1.jpg" },
    ]);
    expect(applied.map((a) => a.count)).toEqual([1, 1, 1]);
    expect(content).toContain(
      '"background_image":{"url":"https:\\/\\/img.test\\/hero.jpg","id":"","size":""',
    );
    expect(content).toContain(
      '{"id":201,"url":"https:\\/\\/site.test\\/wp-content\\/uploads\\/g1.jpg"}',
    );
    expect(content).toContain('{"id":"","url":"https:\\/\\/img.test\\/g2.jpg"}');
    expect(content).toContain('"background_image":{"url":"https:\\/\\/img.test\\/s1.jpg","id":""}');
    // Links are not images.
    expect(content).toContain('"link":{"url":"https:\\/\\/site.test\\/contact"');
  });

  it("swaps fonts and colors in a pretty-printed page export without reformatting it", () => {
    const { content } = applySwaps(PAGE, "elementor", [
      { kind: "font", fromFamily: "inter", to: "DM Sans" },
      { kind: "color", fromRgb: "#111827", to: "#000000" },
      { kind: "color", fromRgb: "#ff0000", to: "#00ff00" },
      { kind: "image", fromUrl: "https://site.test/overlay.png", to: "https://img.test/o.png" },
    ]);
    const expected = PAGE.replace(
      '"typography_font_family": "Inter"',
      '"typography_font_family": "DM Sans"',
    )
      .replace('"background_color": "#111827"', '"background_color": "#000000"')
      .replace('"text_color": "#111827"', '"text_color": "#000000"')
      .replace('"hover_color": "red"', '"hover_color": "#00ff00"')
      .replace(
        '"url": "https://site.test/overlay.png",\n                    "id": 55',
        '"url": "https://img.test/o.png",\n                    "id": ""',
      );
    expect(content).toBe(expected);
    // Numeric-looking keys keep their place and \u escapes are untouched.
    expect(content.indexOf('"10"')).toBeLessThan(content.indexOf('"2"'));
    expect(content).toContain("Caf\\u00e9 text");
    expect(content).toContain('<p style=\\"color:#111827\\">');
  });

  it("respects excluded occurrences", () => {
    const d = detect(PAGE, "elementor");
    const first = d.colors.find((g) => g.rgb === "#111827")?.occurrences[0];
    expect(first?.id).toBe('color:["content",0,"settings","background_color"]');
    const { content, applied } = applySwaps(PAGE, "elementor", [
      { kind: "color", fromRgb: "#111827", to: "#000000", excludeIds: [first?.id ?? ""] },
    ]);
    expect(applied[0]?.count).toBe(1);
    expect(content).toContain('"background_color": "#111827"');
    expect(content).toContain('"text_color": "#000000"');
  });

  it("lists site globals as a warning", () => {
    expect(detect(SECTION, "elementor").warnings).toEqual([
      "3 settings use site global colors or fonts from Elementor's Site Settings, so they can't be swapped here.",
    ]);
    const one = JSON.stringify({
      content: [
        { elType: "widget", settings: { __globals__: { title_color: "globals/colors?id=a" } } },
      ],
    });
    expect(detect(one, "elementor").warnings[0]).toMatch(/^1 setting uses .* it can't be swapped/);
  });

  it("flags relative and data images and skips generic fonts", () => {
    const json = JSON.stringify({
      content: [
        {
          elType: "widget",
          settings: {
            a: { url: "/wp-content/x.jpg", id: 1 },
            b: { url: "data:image/png;base64,AAA", id: 2 },
            typography_font_family: "sans-serif",
            heading_font_family: "",
          },
          elements: "not an array",
        },
        "not an element",
      ],
    });
    const d = detect(json, "elementor");
    expect(d.images.map((i) => i.warning)).toEqual(["relative", "data-uri"]);
    expect(d.images[0]?.snippet).toBe("widget › a");
    expect(d.fonts).toEqual([]);
  });
});

describe("elementor validation", () => {
  it.each([
    ["not json", /isn't valid JSON/],
    ["[]", /doesn't look like an Elementor export/],
    ['{"content":{}}', /doesn't look like an Elementor export/],
    ['{"title":"x"}', /doesn't look like an Elementor export/],
  ])("rejects %s", (json, message) => {
    expect(() => detect(json, "elementor")).toThrow(message);
    expect(() => applySwaps(json, "elementor", [])).toThrow(EngineError);
  });

  it("rejects files over 5 MB", () => {
    const big = JSON.stringify({ content: [], pad: "x".repeat(5 * 1024 * 1024) });
    expect(() => detect(big, "elementor")).toThrow(/larger than 5 MB/);
  });
});

describe("json-locate", () => {
  it("finds exact token ranges, including nested arrays, escapes and duplicates", () => {
    const text =
      ' { "a" : [ 1 , { "b":"x\\"y" } , [ ] , { } , true , null ] , "a2": -1.5e3, "d": 1, "d": 2 } ';
    const tokens = locateTokens(text);
    const at = (path: (string | number)[]) => {
      const t = tokens.get(pathKey(path));
      return t ? text.slice(t.start, t.end) : undefined;
    };
    expect(at(["a", 0])).toBe("1");
    expect(at(["a", 1, "b"])).toBe('"x\\"y"');
    expect(at(["a", 4])).toBe("true");
    expect(at(["a", 5])).toBe("null");
    expect(at(["a2"])).toBe("-1.5e3");
    expect(text.slice(tokens.get(pathKey(["d"]))?.start)).toMatch(/^2 }/);
  });

  it("throws on an unterminated string", () => {
    expect(() => locateTokens('{"a":"x')).toThrow(SyntaxError);
  });

  it("encodes strings in the original style", () => {
    expect(encodeJsonString("https://a.test/x", '"https:\\/\\/b"')).toBe(
      '"https:\\/\\/a.test\\/x"',
    );
    expect(encodeJsonString("https://a.test/x", '"https://b"')).toBe('"https://a.test/x"');
    expect(encodeJsonString("Café", '"x"')).toBe('"Caf\\u00e9"');
  });
});
