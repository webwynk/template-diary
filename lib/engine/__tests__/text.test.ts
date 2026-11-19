import { applySwaps, detectText, EngineError, type Swap, type TextModel } from "@/lib/engine";
import { checkSwaps } from "@/lib/engine/validate";
import { summarizeChanges } from "@/lib/editor/session";
import { changesSummary } from "@/lib/templates/changes";

import { fixture } from "./helpers";

// Text tab, phase T1 (DEVELOPMENT.md §7 "Text tab"): Custom templates.

const HTML = fixture("text-hero-cards.html");

function outline(model: TextModel) {
  return model.groups.map((g) => `${g.label}: ${g.fields.map((f) => f.label).join(", ")}`);
}

function field(model: TextModel, label: string, group?: string) {
  const g = group ? model.groups.find((x) => x.label === group) : undefined;
  const list = g ? g.fields : model.groups.flatMap((x) => x.fields);
  const f = list.find((x) => x.label === label);
  if (!f) throw new Error(`no field ${label}`);
  return f;
}

/** Everything outside [start, end) of `before` is byte-identical in `after`. */
function onlyChanged(before: string, after: string, start: number, end: number, text: string) {
  expect(after).toBe(before.slice(0, start) + text + before.slice(end));
}

describe("detectText (Custom)", () => {
  const model = detectText(HTML, "custom");

  it("groups the section the way it is built", () => {
    expect(outline(model)).toEqual([
      "Heading: Eyebrow, Title, Subheading, Button 1, Button 1 icon, Button 1 link, Button 2, Button 2 link",
      "Feature card 1: Icon, Title, Text, Link, Link URL",
      "Feature card 2: Icon, Title, Text, Link, Link URL",
      "Feature card 3: Icon, Title, Text, Link, Link URL",
      "Content: Item 1 icon, Item 1, Item 2 icon, Item 2, Text",
    ]);
    expect(model.groups.map((g) => g.kind)).toEqual(["heading", "card", "card", "card", "content"]);
  });

  it("reads values the way they are shown", () => {
    expect(field(model, "Eyebrow").value).toBe("Why choose us");
    // Inline formatting is kept as HTML (Hasan's decision).
    expect(field(model, "Title")).toMatchObject({
      type: "html",
      value: "Grow your agency <em>faster</em>",
    });
    // Entities decoded and whitespace collapsed for plain text.
    expect(field(model, "Subheading")).toMatchObject({
      type: "text",
      value: "Everything you need to launch client sites & keep them fast.",
    });
    expect(field(model, "Button 1 link").value).toBe("https://example.com/start?a=1&b=2");
  });

  it("recognizes each kind of icon", () => {
    expect(field(model, "Button 1 icon")).toMatchObject({
      iconKind: "font",
      iconValue: "fa-solid fa-rocket",
    });
    expect(field(model, "Icon", "Feature card 1")).toMatchObject({
      iconKind: "font",
      iconValue: "fa-solid fa-bolt",
    });
    expect(field(model, "Icon", "Feature card 2").iconKind).toBe("svg");
    expect(field(model, "Icon", "Feature card 3")).toMatchObject({
      iconKind: "image",
      iconValue: "https://cdn.example.com/icons/shield.svg",
    });
    expect(field(model, "Item 1 icon")).toMatchObject({ iconKind: "ligature", iconValue: "check" });
  });

  it("never reads scripts, styles, the head or comments", () => {
    const values = model.groups.flatMap((g) => g.fields.map((f) => f.value)).join("\n");
    expect(values).not.toContain("Hello from script");
    expect(values).not.toContain("background");
    const doc = `<!doctype html><html><head><title>Tab title</title></head><body><!-- note --><h1>Hi</h1></body></html>`;
    expect(outline(detectText(doc, "custom"))).toEqual(["Heading: Title"]);
  });

  it("every range holds the source the field was read from", () => {
    for (const f of model.groups.flatMap((g) => g.fields)) {
      if (f.location.kind !== "range") throw new Error("range expected");
      const raw = HTML.slice(f.location.start, f.location.end);
      if (f.type === "html" || f.type === "icon") expect(raw).toBe(f.value);
      expect(f.location.line).toBeGreaterThan(0);
    }
  });

  it("keeps keys stable when other parts of the code change", () => {
    const keys = model.groups.flatMap((g) => g.fields.map((f) => f.key));
    const edited = HTML.replace(
      ".feature-card { padding: 24px; }",
      ".feature-card { padding: 32px; margin: 0; }",
    ).replace('class="lead"', 'class="lead" data-x="1"');
    expect(detectText(edited, "custom").groups.flatMap((g) => g.fields.map((f) => f.key))).toEqual(
      keys,
    );
  });

  it("gives loose text in mixed content its own field", () => {
    const m = detectText("<div>Intro text<p>Para</p>Outro</div>", "custom");
    expect(m.groups[0]!.fields.map((f) => [f.key, f.value])).toEqual([
      ["div[0]/#text[0]|text", "Intro text"],
      ["div[0]/p[0]|text", "Para"],
      ["div[0]/#text[1]|text", "Outro"],
    ]);
  });

  it("names groups after their sections when there are several", () => {
    const m = detectText(
      '<header><nav><a href="/">Home</a><a href="/about">About</a></nav></header><section id="hero"><h1>Big</h1></section><footer><p>© 2026</p></footer>',
      "custom",
    );
    expect(m.groups.map((g) => g.label)).toEqual([
      "Navigation · Content",
      "Hero · Heading",
      "Footer · Content",
    ]);
    expect(m.groups[0]!.fields.map((f) => f.label)).toEqual([
      "Item 1",
      "Item 1 link",
      "Item 2",
      "Item 2 link",
    ]);
  });
});

describe("applySwaps with Text tab edits (Custom)", () => {
  const model = detectText(HTML, "custom");
  const range = (label: string, group?: string) => {
    const loc = field(model, label, group).location;
    if (loc.kind !== "range") throw new Error("range expected");
    return loc;
  };
  const swap = (label: string, to: string, group?: string): Swap => {
    const f = field(model, label, group);
    return { kind: f.type === "link" ? "link" : "text", key: f.key, from: f.value, to };
  };

  it("changes one text and nothing else, escaping what it must", () => {
    const r = range("Eyebrow");
    const out = applySwaps(HTML, "custom", [swap("Eyebrow", "New & <improved>")]);
    onlyChanged(HTML, out.content, r.start, r.end, "New &amp; &lt;improved&gt;");
    expect(out.applied).toEqual([
      {
        kind: "text",
        key: field(model, "Eyebrow").key,
        from: "Why choose us",
        to: "New & <improved>",
        count: 1,
      },
    ]);
  });

  it("writes HTML fields as typed", () => {
    const r = range("Title");
    const out = applySwaps(HTML, "custom", [swap("Title", "Ship <strong>today</strong>")]);
    onlyChanged(HTML, out.content, r.start, r.end, "Ship <strong>today</strong>");
  });

  it("only edits the same words in the field you changed", () => {
    const out = applySwaps(HTML, "custom", [swap("Link", "Learn more", "Feature card 2")]);
    expect(out.content.match(/Read more/g)).toHaveLength(2);
    expect(out.content).toContain('class="link">Learn more</a>');
  });

  it("keeps non-breaking spaces visible", () => {
    const html = "<p>Hello&nbsp;world</p>";
    const f = detectText(html, "custom").groups[0]!.fields[0]!;
    expect(f.value).toBe("Hello world");
    const out = applySwaps(html, "custom", [
      { kind: "text", key: f.key, from: f.value, to: "Hi there" },
    ]);
    expect(out.content).toBe("<p>Hi&nbsp;there</p>");
  });

  it("changes a link and encodes & for the attribute", () => {
    const r = range("Button 2 link");
    const out = applySwaps(HTML, "custom", [swap("Button 2 link", "https://x.dev/?a=1&b=2")]);
    onlyChanged(HTML, out.content, r.start, r.end, "https://x.dev/?a=1&amp;b=2");
  });

  it("quotes an unquoted link value", () => {
    const html = "<a href=/old>Go</a>";
    const f = detectText(html, "custom").groups[0]!.fields.find((x) => x.type === "link")!;
    const out = applySwaps(html, "custom", [
      { kind: "link", key: f.key, from: f.value, to: "/new page".replace(" ", "-") },
    ]);
    expect(out.content).toBe('<a href="/new-page">Go</a>');
  });

  it("makes no change (and reports none) when the text is the same", () => {
    const out = applySwaps(HTML, "custom", [swap("Eyebrow", "Why choose us")]);
    expect(out).toEqual({ content: HTML, applied: [] });
  });

  describe("icons", () => {
    const icon = (
      label: string,
      group: string | undefined,
      as: "class" | "svg" | "image" | "ligature",
      to: string,
    ): Swap => {
      const f = field(model, label, group);
      return { kind: "icon", key: f.key, from: f.value, as, to };
    };

    it("font icon → other classes: keeps size and color classes", () => {
      const out = applySwaps(HTML, "custom", [
        icon("Icon", "Feature card 1", "class", "fa-regular fa-star"),
      ]);
      expect(out.content).toContain('<i class="fa-2x text-amber fa-regular fa-star"></i>');
    });

    it("font icon → SVG and → image", () => {
      const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
      const out = applySwaps(HTML, "custom", [icon("Button 1 icon", undefined, "svg", svg)]);
      expect(out.content).toContain(`${svg} Get started</a>`);
      const img = applySwaps(HTML, "custom", [
        icon("Icon", "Feature card 1", "image", "https://cdn.x.dev/a.png"),
      ]);
      expect(img.content).toContain(
        '<img src="https://cdn.x.dev/a.png" alt="" class="fa-2x text-amber">',
      );
    });

    it("SVG icon → font icon keeps its classes and replaces the whole element", () => {
      const r = range("Icon", "Feature card 2");
      const out = applySwaps(HTML, "custom", [
        icon("Icon", "Feature card 2", "class", "fa-solid fa-star"),
      ]);
      onlyChanged(
        HTML,
        out.content,
        r.start,
        r.end,
        '<i class="w-6 h-6 fa-solid fa-star" aria-hidden="true"></i>',
      );
    });

    it("image icon → another image link changes only src", () => {
      const out = applySwaps(HTML, "custom", [
        icon("Icon", "Feature card 3", "image", "https://cdn.x.dev/lock.svg"),
      ]);
      expect(out.content).toContain(
        '<img class="icon" src="https://cdn.x.dev/lock.svg" alt="" width="32" height="32">',
      );
    });

    it("ligature icon → another name", () => {
      const out = applySwaps(HTML, "custom", [icon("Item 2 icon", undefined, "ligature", "star")]);
      expect(out.content).toContain('<span class="material-icons">star</span> Cancel anytime');
      expect(out.content).toContain('<span class="material-icons">check</span> No setup fees');
    });
  });

  it("applies palette swaps first, then text edits on the result", () => {
    // The Text tab reads the palette's result, so `from` is the recolored SVG.
    const recolored = applySwaps(HTML, "custom", [
      { kind: "color", fromRgb: "#4f46e5", to: "#10b981" },
    ]).content;
    const m = detectText(recolored, "custom");
    const svgField = field(m, "Icon", "Feature card 2");
    expect(svgField.value).toContain("#10b981");
    const out = applySwaps(HTML, "custom", [
      { kind: "color", fromRgb: "#4f46e5", to: "#10b981" },
      swap("Eyebrow", "Hello"),
      {
        kind: "text",
        key: field(m, "Title", "Feature card 2").key,
        from: "Pixel perfect",
        to: "Sharp",
      },
    ]);
    expect(out.content).toContain('fill="#10b981"');
    expect(out.content).toContain('<span class="eyebrow">Hello</span>');
    expect(out.content).toContain("<h3>Sharp</h3>");
    expect(out.applied.map((a) => a.kind)).toEqual(["color", "text", "text"]);
  });

  it("refuses stale, unknown or mismatched edits and changes nothing", () => {
    const eyebrow = field(model, "Eyebrow");
    const cases: Swap[] = [
      { kind: "text", key: eyebrow.key, from: "Something else", to: "x" },
      { kind: "text", key: "section[9]/h1[0]|text", from: "x", to: "y" },
      { kind: "link", key: eyebrow.key, from: eyebrow.value, to: "/x" },
    ];
    for (const s of cases) expect(() => applySwaps(HTML, "custom", [s])).toThrow(EngineError);
  });
});

describe("Text tab edit validation", () => {
  const ok = (s: Swap) => expect(() => checkSwaps([s])).not.toThrow();
  const bad = (s: Swap, message: RegExp) => expect(() => checkSwaps([s])).toThrow(message);

  it("allows ordinary text, including words like 'JavaScript:'", () => {
    ok({ kind: "text", key: "p[0]|text", from: "a", to: "Learn JavaScript: the basics" });
    ok({ kind: "text", key: "p[0]|text", from: "a", to: 'Hi <a href="/x">there</a>' });
  });

  it("blocks scripts, handlers and javascript: links in HTML", () => {
    bad({ kind: "text", key: "p[0]|text", from: "a", to: "<script>alert(1)</script>" }, /scripts/);
    bad(
      { kind: "text", key: "p[0]|text", from: "a", to: '<img src=x onerror="alert(1)">' },
      /event handlers/,
    );
    bad(
      { kind: "text", key: "p[0]|text", from: "a", to: '<a href="javascript:alert(1)">x</a>' },
      /scripts/,
    );
  });

  it("accepts web, mail, phone, anchor and relative links only", () => {
    for (const to of [
      "https://x.dev",
      "mailto:a@b.co",
      "tel:+911234",
      "#pricing",
      "/docs",
      "page.html",
    ]) {
      ok({ kind: "link", key: "a[0]|href", from: "", to });
    }
    for (const to of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "has space"]) {
      bad({ kind: "link", key: "a[0]|href", from: "", to }, /Links/);
    }
  });

  it("checks icons by type", () => {
    ok({ kind: "icon", key: "i[0]|icon", from: "", as: "class", to: "fa-solid fa-star" });
    bad(
      { kind: "icon", key: "i[0]|icon", from: "", as: "class", to: 'fa" onclick="x' },
      /Icon classes/,
    );
    ok({
      kind: "icon",
      key: "i[0]|icon",
      from: "",
      as: "svg",
      to: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>',
    });
    bad(
      { kind: "icon", key: "i[0]|icon", from: "", as: "svg", to: '<svg onload="x"></svg>' },
      /SVG icons/,
    );
    bad({ kind: "icon", key: "i[0]|icon", from: "", as: "svg", to: "<div></div>" }, /single <svg>/);
    bad({ kind: "icon", key: "i[0]|icon", from: "", as: "image", to: "ftp://x" }, /http/);
    bad({ kind: "icon", key: "i[0]|icon", from: "", as: "ligature", to: "Bad Name" }, /Icon names/);
  });

  it("refuses two edits of the same field", () => {
    const s: Swap = { kind: "text", key: "p[0]|text", from: "a", to: "b" };
    expect(() => checkSwaps([s, { ...s, to: "c" }])).toThrow(/twice/);
  });
});

describe("change summaries", () => {
  it("count text, link and icon edits", () => {
    expect(
      summarizeChanges(
        [
          { kind: "color", from: "#000000", to: "#ffffff", count: 2 },
          { kind: "text", key: "a", from: "x", to: "y", count: 1 },
          { kind: "text", key: "b", from: "x", to: "y", count: 1 },
          { kind: "link", key: "c", from: "x", to: "y", count: 1 },
          { kind: "icon", key: "d", from: "x", to: "y", count: 1 },
        ],
        false,
      ),
    ).toBe("1 color, 2 texts, 1 link and 1 icon changed");
    expect(
      changesSummary([
        { kind: "text", key: "a", from: "x", to: "y", count: 1 },
        { kind: "text", key: "a", from: "y", to: "z", count: 1 },
        { kind: "code" },
      ]),
    ).toBe("1 text changed, code edited");
  });
});

describe("edge cases", () => {
  it("handles a self-closing SVG icon", () => {
    const html =
      '<div class="box"><svg class="i" width="16" height="16"/><h3>T</h3><p>Body</p></div>';
    const icon = detectText(html, "custom").groups[0]!.fields.find((f) => f.type === "icon")!;
    expect(icon.value).toBe('<svg class="i" width="16" height="16"/>');
    const out = applySwaps(html, "custom", [
      { kind: "icon", key: icon.key, from: icon.value, as: "image", to: "https://x.dev/i.png" },
    ]);
    expect(out.content).toBe(
      '<div class="box"><img src="https://x.dev/i.png" alt="" class="i" width="16" height="16"><h3>T</h3><p>Body</p></div>',
    );
  });

  it("keeps a row of buttons as separate fields", () => {
    const m = detectText(
      '<h2>Hi</h2><div class="actions"><a class="btn" href="/a">One</a> <a class="btn" href="/b">Two</a></div>',
      "custom",
    );
    expect(m.groups.map((g) => g.fields.map((f) => f.label))).toEqual([
      ["Title", "Button 1", "Button 1 link", "Button 2", "Button 2 link"],
    ]);
  });
});

describe("more grouping rules", () => {
  it("unwraps single wrappers and keeps their link", () => {
    const m = detectText(
      '<div class="x"><h3><span>Wrapped</span></h3><p><a href="/r">Read</a></p></div>',
      "custom",
    );
    expect(m.groups[0]!.fields.map((f) => [f.label, f.key, f.value])).toEqual([
      ["Title", "div[0]/h3[0]/span[0]|text", "Wrapped"],
      ["Link", "div[0]/p[0]/a[0]|text", "Read"],
      ["Link URL", "div[0]/p[0]/a[0]|href", "/r"],
    ]);
  });

  it("finds card titles without headings, eyebrows and subheadings by class, and extra headings", () => {
    const card = (n: number) =>
      `<div class="plan"><span class="badge">Hot</span><div class="plan-name">Plan ${n}</div><p>Details ${n}</p><p>More ${n}</p></div>`;
    const m = detectText(
      `<section aria-label="Pricing"><h2>Plans</h2><h4>Small heading</h4><p class="desc">Pick one</p>${card(1)}${card(2)}</section><header><p>Top</p></header><section><div><b>A</b> b</div></section><section><p>Last</p></section>`,
      "custom",
    );
    expect(outline(m)).toEqual([
      "Pricing · Heading: Title, Heading, Subheading",
      "Pricing · Plan 1: Eyebrow, Title, Text 1, Text 2",
      "Pricing · Plan 2: Eyebrow, Title, Text 1, Text 2",
      "Header · Content: Text",
      "Section 1 · Content: Text",
      "Section 2 · Content: Text",
    ]);
  });

  it("uses a short first line as the card title when nothing else marks it", () => {
    const card = '<div class="tile"><div>Short</div><div>A longer description line</div></div>';
    const m = detectText(card + card, "custom");
    expect(m.groups.map((g) => g.fields.map((f) => f.label))).toEqual([
      ["Title", "Text"],
      ["Title", "Text"],
    ]);
  });

  it("numbers groups with the same name and finds icons by size or at the end of a button", () => {
    const m = detectText(
      '<section><h2>One</h2></section><section><h2>Two</h2><a class="btn" href="/go">Go <img src="https://x.dev/a.png" width="16" height="16"></a></section>',
      "custom",
    );
    expect(outline(m)).toEqual([
      "Section 1 · Heading: Title",
      "Section 2 · Heading: Title, Button, Button icon, Button link",
    ]);
  });
});

describe("more apply rules", () => {
  it("encodes quotes for single-quoted links", () => {
    const html = "<a href='/a'>Go</a>";
    const f = detectText(html, "custom").groups[0]!.fields.find((x) => x.type === "link")!;
    expect(
      applySwaps(html, "custom", [{ kind: "link", key: f.key, from: f.value, to: "/b?x=1&y=2" }])
        .content,
    ).toBe("<a href='/b?x=1&amp;y=2'>Go</a>");
  });

  it("turns a font icon into a Material ligature icon", () => {
    const html = '<button class="btn"><i class="fa fa-star big"></i> Save</button>';
    const icon = detectText(html, "custom").groups[0]!.fields.find((x) => x.type === "icon")!;
    const out = applySwaps(html, "custom", [
      { kind: "icon", key: icon.key, from: icon.value, as: "ligature", to: "save" },
    ]);
    expect(out.content).toBe(
      '<button class="btn"><span class="big material-icons" aria-hidden="true">save</span> Save</button>',
    );
  });

  it("refuses an edit of the wrong kind for a field", () => {
    const html = '<p>Hi <i class="fa fa-star"></i></p>';
    const fields = detectText(html, "custom").groups[0]!.fields;
    const icon = fields.find((x) => x.type === "icon")!;
    const text = fields.find((x) => x.type === "text")!;
    expect(() =>
      applySwaps(html, "custom", [{ kind: "text", key: icon.key, from: icon.value, to: "x" }]),
    ).toThrow(EngineError);
    expect(() =>
      applySwaps(html, "custom", [
        { kind: "icon", key: text.key, from: text.value, as: "class", to: "fa fa-x" },
      ]),
    ).toThrow(EngineError);
  });
});
