import { applySwaps, detectText, EngineError, type Swap, type TextModel } from "@/lib/engine";
import { elementorFontIcon } from "@/lib/engine/text/elementor";

import { fixture } from "./helpers";

// Text tab, phase T2 (DEVELOPMENT.md §7 "Text tab"): Elementor exports.

const JSON_TEXT = fixture("elementor-text.json");
const model = detectText(JSON_TEXT, "elementor");

function outline(m: TextModel) {
  return m.groups.map((g) => `${g.label}: ${g.fields.map((f) => f.label).join(", ")}`);
}

function field(m: TextModel, group: string, label: string) {
  const f = m.groups.find((g) => g.label === group)?.fields.find((x) => x.label === label);
  if (!f) throw new Error(`no field ${group} / ${label}`);
  return f;
}

function edit(group: string, label: string, to: string): Swap {
  const f = field(model, group, label);
  return { kind: f.type === "link" ? "link" : "text", key: f.key, from: f.value, to };
}

/** The export after the change is the same text with only this JSON value replaced. */
function replacedOnce(before: string, after: string, oldToken: string, newToken: string) {
  expect(before.split(oldToken)).toHaveLength(2);
  expect(after).toBe(before.replace(oldToken, newToken));
}

describe("detectText (Elementor)", () => {
  it("groups by section, with repeated columns and containers as cards", () => {
    expect(outline(model)).toEqual([
      "Features · Heading: Eyebrow, Title, Title link, Subheading, Button, Button icon, Button link",
      "Section 2 · Icon box 1: Icon, Title, Text, Link",
      "Section 2 · Icon box 2: Icon, Title, Text, Link",
      "Section 2 · Icon box 3: Icon, Title, Text, Link",
      "Section 3 · Content: Item 1, Item 1 icon, Item 1 link, Item 2, Item 2 icon, Item 2 link",
      "Section 3 · Card 1: Title, Text, Button, Button link",
      "Section 3 · Card 2: Title, Text, Button, Button link",
      "Section 3 · Content 2: Tab 1 title, Tab 1 content, Tab 2 title, Tab 2 content, Quote, Name, Job title, Card title, Card description",
    ]);
    expect(model.groups.map((g) => g.kind)).toEqual([
      "heading",
      "card",
      "card",
      "card",
      "content",
      "card",
      "card",
      "content",
    ]);
  });

  it("uses element ids and setting names as keys, and JSON paths as locations", () => {
    const f = field(model, "Features · Heading", "Button link");
    expect(f).toMatchObject({
      key: "b1start|link.url",
      value: "https://example.com/start",
      location: {
        kind: "path",
        path: ["content", 0, "elements", 0, "elements", 3, "settings", "link", "url"],
      },
    });
    expect(field(model, "Section 3 · Content", "Item 2 link").key).toBe(
      "il00001|icon_list.1.link.url",
    );
  });

  it("marks text with tags or entities as HTML", () => {
    expect(field(model, "Features · Heading", "Title").type).toBe("html");
    expect(field(model, "Features · Heading", "Subheading").type).toBe("html");
    expect(field(model, "Section 2 · Icon box 1", "Title").type).toBe("text");
  });

  it("reads Font Awesome and SVG icons", () => {
    expect(field(model, "Features · Heading", "Button icon")).toMatchObject({
      value: "fa-solid:fas fa-rocket",
      iconKind: "font",
      iconValue: "fas fa-rocket",
    });
    expect(field(model, "Section 2 · Icon box 2", "Icon")).toMatchObject({
      value: "svg:https://cdn.example.com/icons/star.svg",
      iconKind: "image",
    });
  });

  it("skips dynamic texts (with a note), code widgets and non-text add-on settings", () => {
    const all = model.groups.flatMap((g) => g.fields.map((f) => f.value)).join("\n");
    expect(all).not.toContain("Site title");
    expect(all).not.toContain("Raw code");
    expect(all).not.toContain("#111111");
    expect(all).not.toContain("https://x.dev");
    expect(model.warnings).toEqual([
      "1 text comes from Elementor dynamic tags (site data), so it isn't listed here.",
    ]);
  });

  it("reads widgets from the map: slides, price tables, flip boxes, counters and more", () => {
    const widget = (widgetType: string, settings: object) => ({
      id: widgetType.slice(0, 6),
      elType: "widget",
      widgetType,
      settings,
      elements: [],
    });
    const doc = JSON.stringify({
      content: [
        {
          id: "sec",
          elType: "container",
          settings: { _element_id: "pricing" },
          elements: [
            widget("slides", {
              slides: [
                {
                  heading: "Slide one",
                  description: "Desc",
                  button_text: "Go",
                  link: { url: "/s" },
                },
              ],
            }),
            widget("price-table", {
              heading: "Pro",
              price: "49",
              features_list: [
                {
                  item_text: "Unlimited",
                  selected_item_icon: { value: "fas fa-check", library: "fa-solid" },
                },
              ],
              button_text: "Buy",
              link: { url: "/buy" },
            }),
            widget("flip-box", { title_text_a: "Front", description_text_b: "Back" }),
            widget("counter", { title: "Clients", suffix: "+" }),
            widget("social-icons", {
              social_icon_list: [
                {
                  social_icon: { value: "fab fa-x-twitter", library: "fa-brands" },
                  link: { url: "https://x.com/a" },
                },
              ],
            }),
            widget("icon", { selected_icon: "fa fa-star" }),
          ],
        },
      ],
    });
    expect(outline(detectText(doc, "elementor"))).toEqual([
      "Heading: Slide 1 heading, Slide 1 text, Slide 1 button, Slide 1 link, Title, Price, Feature 1, Feature 1 icon, Button, Button link, Front title, Back text, Suffix, Heading, Icon 1, Icon 1 link, Icon",
    ]);
  });
});

describe("applySwaps with Text tab edits (Elementor)", () => {
  it("replaces one string token and nothing else", () => {
    const out = applySwaps(JSON_TEXT, "elementor", [
      edit("Section 2 · Icon box 1", "Title", "Quick setup"),
    ]);
    replacedOnce(JSON_TEXT, out.content, '"Fast setup"', '"Quick setup"');
    expect(out.applied).toEqual([
      { kind: "text", key: "ib00001|title_text", from: "Fast setup", to: "Quick setup", count: 1 },
    ]);
  });

  it("keeps the export's \\/ escaping and writes HTML as typed", () => {
    const out = applySwaps(JSON_TEXT, "elementor", [
      edit("Features · Heading", "Title", "Ship <strong>today</strong>"),
    ]);
    replacedOnce(
      JSON_TEXT,
      out.content,
      '"Grow your agency <em>faster<\\/em>"',
      '"Ship <strong>today<\\/strong>"',
    );
  });

  it("changes links, including empty ones", () => {
    const out = applySwaps(JSON_TEXT, "elementor", [
      edit("Section 2 · Icon box 2", "Link", "https://x.dev/design"),
    ]);
    const parsed = JSON.parse(out.content);
    expect(parsed.content[1].elements[1].elements[0].settings.link.url).toBe(
      "https://x.dev/design",
    );
    // An empty original has no "\\/" style to follow, so the URL is written plainly.
    expect(out.content).toContain('"url": "https://x.dev/design"');
  });

  it("swaps an icon to other Font Awesome classes, and FA6 names become Elementor's FA5 names", () => {
    const f = field(model, "Features · Heading", "Button icon");
    const out = applySwaps(JSON_TEXT, "elementor", [
      { kind: "icon", key: f.key, from: f.value, as: "class", to: "fa-regular fa-star" },
    ]);
    expect(
      JSON.parse(out.content).content[0].elements[0].elements[3].settings.selected_icon,
    ).toEqual({
      value: "far fa-star",
      library: "fa-regular",
    });
    replacedOnce(
      JSON_TEXT,
      out.content,
      '{ "value": "fas fa-rocket", "library": "fa-solid" }',
      '{"value":"far fa-star","library":"fa-regular"}',
    );
  });

  it("swaps an icon to an SVG link (media id cleared) and an SVG icon back to Font Awesome", () => {
    const font = field(model, "Section 2 · Icon box 1", "Icon");
    const svg = field(model, "Section 2 · Icon box 2", "Icon");
    const out = applySwaps(JSON_TEXT, "elementor", [
      {
        kind: "icon",
        key: font.key,
        from: font.value,
        as: "image",
        to: "https://cdn.x.dev/bolt.svg",
      },
      { kind: "icon", key: svg.key, from: svg.value, as: "class", to: "fas fa-star" },
    ]);
    const cols = JSON.parse(out.content).content[1].elements;
    expect(cols[0].elements[0].settings.selected_icon).toEqual({
      value: { url: "https://cdn.x.dev/bolt.svg", id: "" },
      library: "svg",
    });
    expect(cols[1].elements[0].settings.selected_icon).toEqual({
      value: "fas fa-star",
      library: "fa-solid",
    });
  });

  it("refuses icons Elementor can't store", () => {
    const f = field(model, "Features · Heading", "Button icon");
    expect(() =>
      applySwaps(JSON_TEXT, "elementor", [
        { kind: "icon", key: f.key, from: f.value, as: "svg", to: '<svg viewBox="0 0 1 1"></svg>' },
      ]),
    ).toThrow(/Font Awesome classes or an SVG link/);
    expect(() =>
      applySwaps(JSON_TEXT, "elementor", [
        { kind: "icon", key: f.key, from: f.value, as: "class", to: "bi bi-star" },
      ]),
    ).toThrow(EngineError);
  });

  it("edits a legacy string icon with classes only", () => {
    const doc = JSON.stringify({
      content: [
        {
          id: "w",
          elType: "widget",
          widgetType: "icon",
          settings: { selected_icon: "fa fa-star" },
          elements: [],
        },
      ],
    });
    const f = detectText(doc, "elementor").groups[0]!.fields[0]!;
    expect(
      applySwaps(doc, "elementor", [
        { kind: "icon", key: f.key, from: f.value, as: "class", to: "fas fa-heart" },
      ]).content,
    ).toContain('"selected_icon":"fas fa-heart"');
    expect(() =>
      applySwaps(doc, "elementor", [
        { kind: "icon", key: f.key, from: f.value, as: "image", to: "https://x.dev/a.svg" },
      ]),
    ).toThrow(/older icon/);
  });

  it("applies palette swaps first, then text edits", () => {
    const out = applySwaps(JSON_TEXT, "elementor", [
      { kind: "color", fromRgb: "#0f172a", to: "#111827" },
      edit("Features · Heading", "Eyebrow", "Why us"),
    ]);
    expect(out.content).toContain('"background_color": "#111827"');
    expect(out.content).toContain('"title": "Why us"');
    expect(out.applied.map((a) => a.kind)).toEqual(["color", "text"]);
  });

  it("refuses stale or unknown edits and makes no change for the same text", () => {
    const f = field(model, "Section 2 · Icon box 1", "Title");
    expect(() =>
      applySwaps(JSON_TEXT, "elementor", [{ kind: "text", key: f.key, from: "Old", to: "New" }]),
    ).toThrow(EngineError);
    expect(() =>
      applySwaps(JSON_TEXT, "elementor", [{ kind: "text", key: "nope|title", from: "x", to: "y" }]),
    ).toThrow(EngineError);
    expect(() =>
      applySwaps(JSON_TEXT, "elementor", [{ kind: "link", key: f.key, from: f.value, to: "/x" }]),
    ).toThrow(EngineError);
    expect(
      applySwaps(JSON_TEXT, "elementor", [edit("Section 2 · Icon box 1", "Title", "Fast setup")]),
    ).toEqual({
      content: JSON_TEXT,
      applied: [],
    });
  });
});

describe("elementorFontIcon", () => {
  it("maps Font Awesome 5/6 classes and Elementor's own icons", () => {
    expect(elementorFontIcon("fa-brands fa-github fa-2x")).toEqual({
      value: "fab fa-github fa-2x",
      library: "fa-brands",
    });
    expect(elementorFontIcon("fas fa-star")).toEqual({ value: "fas fa-star", library: "fa-solid" });
    expect(elementorFontIcon("eicon-star")).toEqual({ value: "eicon-star", library: "eicons" });
    expect(() => elementorFontIcon("fa-star")).toThrow(EngineError);
  });
});
