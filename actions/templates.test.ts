// @vitest-environment node
import { readFileSync } from "node:fs";

import { createTemplateAction, getVariationContentAction } from "@/actions/templates";
import { gzipText } from "@/lib/templates/upload";

const createTemplate = vi.fn();
const getVariationContent = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u", email: "e" })) }));
vi.mock("@/lib/db/templates", () => ({
  createTemplate: (...args: unknown[]) => createTemplate(...args),
  getVariationContent: (id: string) => getVariationContent(id),
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
    await expect(createTemplateAction(fd)).rejects.toThrow("REDIRECT /templates/new-id");

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
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(message);
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

function fixtureText(name: string): string {
  return readFileSync(`lib/engine/__tests__/fixtures/${name}`, "utf8");
}
