// @vitest-environment node
import { readFileSync } from "node:fs";

import {
  createTemplateAction,
  getVariationContentAction,
  saveVariationAction,
  updateVariationAction,
} from "@/actions/templates";
import { gzipText } from "@/lib/templates/upload";

const createTemplate = vi.fn();
const getVariationContent = vi.fn();
const getBaseForSave = vi.fn();
const insertVariation = vi.fn();
const getVariationForUpdate = vi.fn();
const updateVariationContent = vi.fn();
const refresh = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u", email: "e" })) }));
vi.mock("@/lib/db/templates", () => ({
  createTemplate: (...args: unknown[]) => createTemplate(...args),
  getVariationContent: (id: string) => getVariationContent(id),
  getBaseForSave: (...args: unknown[]) => getBaseForSave(...args),
  insertVariation: (...args: unknown[]) => insertVariation(...args),
  getVariationForUpdate: (...args: unknown[]) => getVariationForUpdate(...args),
  updateVariationContent: (...args: unknown[]) => updateVariationContent(...args),
  VARIATION_NAME_TAKEN: "This template already has a variation with that name.",
}));

const TAG = "4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f";

async function form(fields: Record<string, string>, content: string | Blob | null) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (content !== null)
    fd.set("content", typeof content === "string" ? await gzipText(content) : content);
  return fd;
}

beforeEach(() => {
  createTemplate.mockReset();
  getVariationContent.mockReset();
  getBaseForSave.mockReset();
  insertVariation.mockReset();
  getVariationForUpdate.mockReset();
  updateVariationContent.mockReset();
  refresh.mockReset();
});

describe("createTemplateAction", () => {
  it("saves the exact content with a server-computed summary, then opens the template", async () => {
    const html = fixtureText("colors.html");
    createTemplate.mockResolvedValueOnce({ ok: true, data: { id: "new-id" } });
    const fd = await form(
      {
        name: " Hero dark ",
        type: "custom",
        tagIds: JSON.stringify([TAG]),
        notes: "",
        usedIn: "client-x.com",
      },
      html,
    );
    expect(await createTemplateAction(fd)).toEqual({ ok: true, id: "new-id" });
    expect(refresh).toHaveBeenCalledOnce();

    const [details, content, detected] = createTemplate.mock.calls[0] as [
      unknown,
      string,
      { colors: unknown[] },
    ];
    expect(details).toEqual({
      name: "Hero dark",
      type: "custom",
      tagIds: [TAG],
      notes: null,
      usedIn: "client-x.com",
    });
    expect(content).toBe(html);
    expect(detected).toMatchObject({
      v: 1,
      colorCount: 5,
      colors: expect.arrayContaining([{ rgb: "#4f46e5", count: 8 }]),
    });
  });

  it("validates Elementor exports on the server", async () => {
    const fd = await form({ name: "x", type: "elementor", tagIds: "[]" }, '{"nope":1}');
    expect(await createTemplateAction(fd)).toEqual({
      ok: false,
      error: expect.stringMatching(/Elementor export/),
    });
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "", type: "custom", tagIds: "[]" }, "<p>x</p>", /Enter a template name/],
    [{ name: "x", type: "custom", tagIds: "{bad json" }, "<p>x</p>", /./],
    [{ name: "x", type: "custom", tagIds: "[]" }, null, /couldn't be read/],
    [{ name: "x", type: "custom", tagIds: "[]" }, new Blob(["plain"]), /couldn't be read/],
    [{ name: "x", type: "custom", tagIds: "[]" }, "   ", /Paste your template code/],
  ])("rejects bad input %#", async (fields, content, message) => {
    const result = await createTemplateAction(await form(fields, content));
    expect(result).toEqual({ ok: false, error: expect.stringMatching(message) });
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("returns database errors", async () => {
    createTemplate.mockResolvedValueOnce({
      ok: false,
      error: "One of the selected tags no longer exists.",
    });
    const result = await createTemplateAction(
      await form({ name: "x", type: "custom", tagIds: "[]" }, "<p>x</p>"),
    );
    expect(result).toEqual({ ok: false, error: "One of the selected tags no longer exists." });
  });
});

describe("getVariationContentAction", () => {
  it("returns the exact content, and errors for bad or missing ids", async () => {
    getVariationContent.mockResolvedValueOnce({
      ok: true,
      data: {
        content: "<p>\r\n</p> ",
        variationName: "Original",
        templateName: "x",
        type: "custom",
      },
    });
    expect(await getVariationContentAction(TAG)).toEqual({ ok: true, content: "<p>\r\n</p> " });
    expect((await getVariationContentAction("nope")).ok).toBe(false);
    getVariationContent.mockResolvedValueOnce({ ok: true, data: null });
    expect((await getVariationContentAction(TAG)).ok).toBe(false);
  });
});

describe("saveVariationAction", () => {
  const TEMPLATE = "0b6f0a52-3c1d-4e2f-8a9b-1c2d3e4f5a6b";
  const BASE = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";
  const ROBO = [
    '<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap" rel="stylesheet">',
    '<section class="hero" style="background:#0f172a">',
    '  <h1 style="color:#4F46E5">Robo</h1>',
    '  <img src="https://cdn.test/robot.png" alt="">',
    "</section>",
    "<style>.hero{font-family:'Open Sans',sans-serif;border-color:rgba(79,70,229,.5)} .x{color:#0f172a}</style>",
    '<script>const keep = "#4f46e5";</script>',
    "",
  ].join("\r\n");
  const SWAPS = [
    { kind: "color", fromRgb: "#4f46e5", to: "#10b981" },
    { kind: "color", fromRgb: "#0f172a", to: "#111827" },
    { kind: "image", fromUrl: "https://cdn.test/robot.png", to: "https://img.test/new.jpg" },
    { kind: "font", fromFamily: "Open Sans", to: "Inter" },
  ];

  async function saveForm(fields: Record<string, string>, source: string) {
    const fd = new FormData();
    const all = {
      templateId: TEMPLATE,
      baseVariationId: BASE,
      name: "Robo website section",
      ...fields,
    };
    for (const [k, v] of Object.entries(all)) fd.set(k, v);
    fd.set("source", await gzipText(source));
    return fd;
  }

  it("saves 2 colors, 1 image and 1 font, and nothing else changes (diff test)", async () => {
    getBaseForSave.mockResolvedValueOnce({ ok: true, data: { content: ROBO, type: "custom" } });
    insertVariation.mockResolvedValueOnce({ ok: true, data: { id: "var-1" } });
    const result = await saveVariationAction(
      await saveForm({ usedIn: "robo-agency.com", swaps: JSON.stringify(SWAPS) }, ROBO),
    );
    expect(result).toEqual({ ok: true, id: "var-1" });
    expect(getBaseForSave).toHaveBeenCalledWith(TEMPLATE, BASE);

    const saved = insertVariation.mock.calls[0]![0] as {
      content: string;
      changes: unknown[];
      detected: { colors: { rgb: string }[] };
    };
    // Every byte outside the swapped values is identical, including CRLF line endings and the
    // script string that only looks like a color.
    const expected = ROBO.replace("family=Open+Sans", "family=Inter")
      .replace("background:#0f172a", "background:#111827")
      .replace("color:#4F46E5", "color:#10B981")
      .replace("https://cdn.test/robot.png", "https://img.test/new.jpg")
      .replace("'Open Sans'", "'Inter'")
      .replace("rgba(79,70,229,.5)", "rgba(16,185,129,0.5)") // alpha is written in full
      .replace(".x{color:#0f172a}", ".x{color:#111827}");
    expect(saved.content).toBe(expected);
    expect(saved).toMatchObject({
      templateId: TEMPLATE,
      parentVariationId: BASE,
      name: "Robo website section",
      usedIn: "robo-agency.com",
    });
    expect(saved.changes).toEqual([
      { kind: "color", from: "#4f46e5", to: "#10b981", count: 2 },
      { kind: "color", from: "#0f172a", to: "#111827", count: 2 },
      {
        kind: "image",
        from: "https://cdn.test/robot.png",
        to: "https://img.test/new.jpg",
        count: 1,
      },
      { kind: "font", from: "Open Sans", to: "Inter", count: 2 },
    ]);
    expect(saved.detected.colors.map((c) => c.rgb).sort()).toEqual(["#10b981", "#111827"]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("records manual code edits and applies swaps to the edited source", async () => {
    getBaseForSave.mockResolvedValueOnce({ ok: true, data: { content: ROBO, type: "custom" } });
    insertVariation.mockResolvedValueOnce({ ok: true, data: { id: "var-2" } });
    const edited = ROBO.replace("Robo", "Robo v2");
    await saveVariationAction(await saveForm({ swaps: JSON.stringify([SWAPS[2]]) }, edited));
    const saved = insertVariation.mock.calls[0]![0] as { content: string; changes: unknown[] };
    expect(saved.content).toBe(
      edited.replace("https://cdn.test/robot.png", "https://img.test/new.jpg"),
    );
    expect(saved.changes).toEqual([
      {
        kind: "image",
        from: "https://cdn.test/robot.png",
        to: "https://img.test/new.jpg",
        count: 1,
      },
      { kind: "code" },
    ]);
  });

  it("swaps Elementor JSON in place", async () => {
    const json = fixtureText("elementor-section.json");
    const color = /#[0-9a-fA-F]{6}\b/.exec(json)![0].toLowerCase();
    getBaseForSave.mockResolvedValueOnce({ ok: true, data: { content: json, type: "elementor" } });
    insertVariation.mockResolvedValueOnce({ ok: true, data: { id: "var-3" } });
    const swaps = [{ kind: "color", fromRgb: color, to: "#123456" }];
    expect(
      await saveVariationAction(await saveForm({ swaps: JSON.stringify(swaps) }, json)),
    ).toEqual({ ok: true, id: "var-3" });
    const saved = insertVariation.mock.calls[0]![0] as { content: string };
    // Only color settings change; the heading text "Red heading #4F46E5" stays as it is.
    expect(saved.content).toBe(
      json
        .replace('"background_color":"#4F46E5"', '"background_color":"#123456"')
        .replace("rgba(79, 70, 229, 0.1)", "rgba(18, 52, 86, 0.1)")
        .replace('"title_color":"#4F46E5"', '"title_color":"#123456"')
        .replace('"background_color":"#4f46e5"', '"background_color":"#123456"'),
    );
  });

  it("refuses saves without changes, bad input and missing bases", async () => {
    getBaseForSave.mockResolvedValue({ ok: true, data: { content: ROBO, type: "custom" } });
    expect(await saveVariationAction(await saveForm({ swaps: "[]" }, ROBO))).toEqual({
      ok: false,
      error: "There are no changes to save yet.",
    });
    expect(await saveVariationAction(await saveForm({ name: "  ", swaps: "[]" }, ROBO))).toEqual({
      ok: false,
      error: "Enter a name for this variation.",
      field: "name",
    });
    expect((await saveVariationAction(await saveForm({ swaps: "{nope" }, ROBO))).ok).toBe(false);
    const badTarget = [
      { kind: "image", fromUrl: "https://cdn.test/robot.png", to: "javascript:x" },
    ];
    expect(
      (await saveVariationAction(await saveForm({ swaps: JSON.stringify(badTarget) }, ROBO))).ok,
    ).toBe(false);

    getBaseForSave.mockResolvedValueOnce({ ok: true, data: null });
    expect(
      await saveVariationAction(await saveForm({ swaps: JSON.stringify(SWAPS) }, ROBO)),
    ).toEqual({
      ok: false,
      error: "The variation you started from no longer exists.",
    });
    expect(insertVariation).not.toHaveBeenCalled();
  });

  it("shows a taken name next to the name field", async () => {
    getBaseForSave.mockResolvedValueOnce({ ok: true, data: { content: ROBO, type: "custom" } });
    insertVariation.mockResolvedValueOnce({
      ok: false,
      error: "This template already has a variation with that name.",
    });
    expect(
      await saveVariationAction(await saveForm({ swaps: JSON.stringify(SWAPS) }, ROBO)),
    ).toEqual({
      ok: false,
      error: "This template already has a variation with that name.",
      field: "name",
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("updateVariationAction", () => {
  const TEMPLATE = "0b6f0a52-3c1d-4e2f-8a9b-1c2d3e4f5a6b";
  const VAR = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";
  const STAMP = "2026-11-18T19:00:00.123456+00:00";
  const CODE = '<p style="color:#4f46e5">Hi</p>';

  async function updateForm(source: string, swaps: unknown[] = []) {
    const fd = new FormData();
    fd.set("templateId", TEMPLATE);
    fd.set("variationId", VAR);
    fd.set("baseUpdatedAt", STAMP);
    fd.set("swaps", JSON.stringify(swaps));
    fd.set("source", await gzipText(source));
    return fd;
  }
  const row = (over: Record<string, unknown> = {}) => ({
    ok: true,
    data: {
      content: CODE,
      changes: [{ kind: "font", from: "A", to: "B", count: 1 }],
      type: "custom",
      isOriginal: false,
      ...over,
    },
  });

  it("overwrites the variation with the edited code and swaps, appending to its changes", async () => {
    getVariationForUpdate.mockResolvedValueOnce(row());
    updateVariationContent.mockResolvedValueOnce({ ok: true, data: true });
    const edited = CODE.replace("Hi", "Hello");
    const result = await updateVariationAction(
      await updateForm(edited, [{ kind: "color", fromRgb: "#4f46e5", to: "#10b981" }]),
    );
    expect(result).toEqual({ ok: true });
    const input = updateVariationContent.mock.calls[0]![0] as Record<string, unknown>;
    expect(input).toMatchObject({
      templateId: TEMPLATE,
      variationId: VAR,
      expectedUpdatedAt: STAMP,
      content: '<p style="color:#10b981">Hello</p>',
    });
    expect(input.changes).toEqual([
      { kind: "font", from: "A", to: "B", count: 1 },
      { kind: "color", from: "#4f46e5", to: "#10b981", count: 1 },
      { kind: "code" },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("never overwrites the Original, unchanged code or a variation changed elsewhere", async () => {
    getVariationForUpdate.mockResolvedValueOnce(row({ isOriginal: true }));
    expect(await updateVariationAction(await updateForm("<p>x</p>"))).toEqual({
      ok: false,
      error: "The Original is locked. Save your changes as a new variation.",
    });
    getVariationForUpdate.mockResolvedValueOnce(row());
    expect(await updateVariationAction(await updateForm(CODE))).toEqual({
      ok: false,
      error: "There are no changes to save yet.",
    });
    getVariationForUpdate.mockResolvedValueOnce({ ok: true, data: null });
    expect((await updateVariationAction(await updateForm("<p>x</p>"))).ok).toBe(false);
    expect(updateVariationContent).not.toHaveBeenCalled();

    getVariationForUpdate.mockResolvedValueOnce(row());
    updateVariationContent.mockResolvedValueOnce({ ok: true, data: false });
    expect(await updateVariationAction(await updateForm("<p>x</p>"))).toEqual({
      ok: false,
      error: expect.stringMatching(/changed somewhere else/),
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

function fixtureText(name: string): string {
  return readFileSync(`lib/engine/__tests__/fixtures/${name}`, "utf8");
}
