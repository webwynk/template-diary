// @vitest-environment node
import { POST } from "@/app/api/screenshot/route";

vi.mock("server-only", () => ({}));
const getCurrentUser = vi.fn(async () => ({ id: "user-1", email: "e" }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
const getScreenshotSource = vi.fn();
const saveFeatureImage = vi.fn();
vi.mock("@/lib/db/feature-images", () => ({
  getScreenshotSource: (t: unknown) => getScreenshotSource(t),
  saveFeatureImage: (i: unknown) => saveFeatureImage(i),
  signFeatureImages: async (paths: string[]) =>
    new Map(paths.map((p) => [p, `https://signed/${p}`])),
}));
const renderScreenshot = vi.fn<(html: string) => Promise<Buffer>>(async () => Buffer.from("png"));
vi.mock("@/lib/screenshot/render", () => ({
  renderScreenshot: (h: string) => renderScreenshot(h),
}));
vi.mock("@/lib/images/process", () => ({ screenshotToWebp: async () => Buffer.from("webp") }));

const T = "0b6f0a52-3c1d-4e2f-8a9b-1c2d3e4f5a6b";
const V = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://app.test/api/screenshot", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://app.test", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  getScreenshotSource.mockReset();
  saveFeatureImage.mockReset();
  renderScreenshot.mockClear();
});

describe("POST /api/screenshot", () => {
  it("renders the Original and fills an empty template image", async () => {
    getScreenshotSource.mockResolvedValueOnce({
      ok: true,
      data: { type: "custom", content: "<p>Hi</p>" },
    });
    saveFeatureImage.mockResolvedValueOnce({
      ok: true,
      data: { saved: true, path: "user-1/t/x.webp" },
    });
    const res = await post({ templateId: T, replace: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "https://signed/user-1/t/x.webp" });
    expect(getScreenshotSource).toHaveBeenCalledWith({ kind: "template", templateId: T });
    expect(renderScreenshot).toHaveBeenCalledWith("<p>Hi</p>");
    expect(saveFeatureImage).toHaveBeenCalledWith({
      ownerId: "user-1",
      target: { kind: "template", templateId: T },
      webp: Buffer.from("webp"),
      source: "auto",
      onlyIfEmpty: true,
    });
  });

  it("renders a variation and replaces its image by default", async () => {
    getScreenshotSource.mockResolvedValueOnce({ ok: true, data: { type: "custom", content: "x" } });
    saveFeatureImage.mockResolvedValueOnce({ ok: true, data: { saved: false } });
    const res = await post({ templateId: T, variationId: V });
    expect(await res.json()).toEqual({ ok: true, skipped: true });
    expect(saveFeatureImage.mock.calls[0]![0]).toMatchObject({
      target: { kind: "variation", templateId: T, variationId: V },
      onlyIfEmpty: false,
    });
  });

  it("refuses cross-site requests, bad bodies, Elementor and missing templates", async () => {
    expect((await post({ templateId: T }, { origin: "https://evil.test" })).status).toBe(403);
    expect((await post({ templateId: T }, { "content-type": "text/plain" })).status).toBe(403);
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ templateId: "nope" })).status).toBe(400);

    getScreenshotSource.mockResolvedValueOnce({
      ok: true,
      data: { type: "elementor", content: "{}" },
    });
    expect((await post({ templateId: T })).status).toBe(400);
    getScreenshotSource.mockResolvedValueOnce({ ok: true, data: null });
    expect((await post({ templateId: T })).status).toBe(404);
    expect(renderScreenshot).not.toHaveBeenCalled();
  });

  it("reports a failed render without saving anything", async () => {
    getScreenshotSource.mockResolvedValueOnce({ ok: true, data: { type: "custom", content: "x" } });
    renderScreenshot.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ templateId: T });
    expect(res.status).toBe(502);
    expect(saveFeatureImage).not.toHaveBeenCalled();
  });
});
