import {
  buildSrcdoc,
  isFullDocument,
  parsePreviewMessage,
  PREVIEW_MESSAGE_SOURCE,
} from "@/lib/preview/build-srcdoc";

describe("buildSrcdoc", () => {
  it("wraps fragments in a minimal document with charset, viewport and the bridge first", () => {
    const out = buildSrcdoc("<section>Hi</section>");
    expect(out.startsWith('<!doctype html><html><head><meta charset="utf-8">')).toBe(true);
    expect(out).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(out.indexOf("<script>")).toBeLessThan(out.indexOf("<section>"));
    expect(out.endsWith("<body><section>Hi</section></body></html>")).toBe(true);
  });

  it("keeps full documents as they are and injects the bridge into <head>", () => {
    const doc =
      '<!-- c -->\n<!DOCTYPE html><html lang="en"><head><title>x</title></head><body>b</body></html>';
    const out = buildSrcdoc(doc);
    expect(out.replace(/<script>[\s\S]*?<\/script>/, "")).toBe(doc);
    expect(out.indexOf("<script>")).toBe(doc.indexOf("<title>"));
  });

  it("adds a head when a full document has none", () => {
    const out = buildSrcdoc("<html><body>b</body></html>");
    expect(out).toMatch(/^<html><head><script>[\s\S]*<\/script><\/head><body>b<\/body><\/html>$/);
    expect(buildSrcdoc("<!doctype html><p>x</p>")).toMatch(
      /^<!doctype html><script>[\s\S]*<\/script><p>x<\/p>$/,
    );
  });

  it("detects full documents", () => {
    expect(isFullDocument("  <!doctype html>")).toBe(true);
    expect(isFullDocument("<HTML>")).toBe(true);
    expect(isFullDocument("<div></div>")).toBe(false);
  });

  it("never gives the bridge a way out of its script tag", () => {
    const out = buildSrcdoc("x");
    expect(out.match(/<\/script/gi)).toHaveLength(1);
  });
});

describe("parsePreviewMessage", () => {
  it("accepts only well-formed messages from the bridge", () => {
    expect(
      parsePreviewMessage({ source: PREVIEW_MESSAGE_SOURCE, type: "height", height: 1200 }),
    ).toMatchObject({
      height: 1200,
    });
    expect(
      parsePreviewMessage({ source: PREVIEW_MESSAGE_SOURCE, type: "height", height: 1e9 }),
    ).toMatchObject({
      height: 50_000,
    });
    expect(
      parsePreviewMessage({
        source: PREVIEW_MESSAGE_SOURCE,
        type: "error",
        message: "x".repeat(900),
      }),
    ).toMatchObject({ message: "x".repeat(500) });
    expect(parsePreviewMessage({ source: "other", type: "height", height: 1 })).toBeNull();
    expect(
      parsePreviewMessage({ source: PREVIEW_MESSAGE_SOURCE, type: "height", height: "1" }),
    ).toBeNull();
    expect(
      parsePreviewMessage({ source: PREVIEW_MESSAGE_SOURCE, type: "error", message: 1 }),
    ).toBeNull();
    expect(parsePreviewMessage({ source: PREVIEW_MESSAGE_SOURCE, type: "nav" })).toBeNull();
    expect(parsePreviewMessage("string")).toBeNull();
    expect(parsePreviewMessage(null)).toBeNull();
  });
});
