import { readFileSync } from "node:fs";

import { MAX_CONTENT_BYTES } from "@/lib/engine/types";
import { byteLength, checkContent, formatBytes } from "@/lib/templates/content";
import { downloadFilename, slugify } from "@/lib/templates/filename";

const fixture = (name: string) => readFileSync(`lib/engine/__tests__/fixtures/${name}`, "utf8");

describe("checkContent", () => {
  it("accepts Custom code as is", () => {
    expect(checkContent("<p>hi</p>", "custom")).toEqual({ ok: true, elementor: null });
  });

  it("describes Elementor exports (type and widget count at any depth)", () => {
    expect(checkContent(fixture("elementor-section.json"), "elementor")).toEqual({
      ok: true,
      elementor: { kind: "section", widgets: 3 },
    });
    expect(checkContent(fixture("elementor-page.json"), "elementor")).toEqual({
      ok: true,
      elementor: { kind: "page", widgets: 2 },
    });
    expect(checkContent('{"content":[]}', "elementor")).toEqual({
      ok: true,
      elementor: { kind: "template", widgets: 0 },
    });
  });

  it.each([
    ["", "custom", /Paste your template code/],
    ["   \n", "elementor", /Upload an Elementor/],
    ["a\u0000b", "custom", /NUL/],
    ["not json", "elementor", /isn't valid JSON/],
    ['{"title":"x"}', "elementor", /doesn't look like an Elementor export/],
  ] as const)("rejects %j as %s", (content, type, message) => {
    const result = checkContent(content, type);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it("enforces the 5 MB limit in bytes", () => {
    expect(checkContent("a".repeat(MAX_CONTENT_BYTES), "custom").ok).toBe(true);
    expect(checkContent("é".repeat(MAX_CONTENT_BYTES / 2 + 1), "custom").ok).toBe(false);
  });
});

describe("sizes", () => {
  it("counts bytes and formats them", () => {
    expect(byteLength("é")).toBe(2);
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(20 * 1024)).toBe("20 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("download filenames", () => {
  it("slugifies template and variation names", () => {
    expect(downloadFilename("Hero dark", "Robo website section", "elementor")).toBe(
      "hero-dark-robo-website-section.json",
    );
    expect(downloadFilename("Café Pricing!", "Original", "custom")).toBe(
      "cafe-pricing-original.html",
    );
    expect(slugify("???")).toBe("template");
    expect(slugify(`${"a".repeat(79)} b`)).toBe("a".repeat(79));
  });
});
