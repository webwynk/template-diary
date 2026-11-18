// @vitest-environment node
import sharp from "sharp";

import { removeFeatureImageAction, uploadFeatureImageAction } from "@/actions/feature-images";

vi.mock("server-only", () => ({}));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1", email: "e" })),
}));
const saveFeatureImage = vi.fn();
const removeFeatureImage = vi.fn();
vi.mock("@/lib/db/feature-images", () => ({
  saveFeatureImage: (i: unknown) => saveFeatureImage(i),
  removeFeatureImage: (t: unknown) => removeFeatureImage(t),
  signFeatureImages: async (paths: string[]) =>
    new Map(paths.map((p) => [p, `https://signed/${p}`])),
}));

const T = "0b6f0a52-3c1d-4e2f-8a9b-1c2d3e4f5a6b";
const V = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";

function form(fields: Record<string, string>, image?: Blob) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (image) fd.set("image", image, "x.png");
  return fd;
}

beforeEach(() => {
  saveFeatureImage.mockReset();
  removeFeatureImage.mockReset();
  refresh.mockReset();
});

describe("uploadFeatureImageAction", () => {
  it("stores a re-encoded WebP for a variation", async () => {
    const png = await sharp({ create: { width: 64, height: 40, channels: 3, background: "#fff" } })
      .png()
      .toBuffer();
    saveFeatureImage.mockResolvedValueOnce({ ok: true, data: { saved: true, path: "p.webp" } });
    const result = await uploadFeatureImageAction(
      form({ templateId: T, variationId: V }, new Blob([png], { type: "image/png" })),
    );
    expect(result).toEqual({ ok: true, url: "https://signed/p.webp" });
    const input = saveFeatureImage.mock.calls[0]![0] as {
      webp: Buffer;
      target: unknown;
      source: string;
    };
    expect(input.target).toEqual({ kind: "variation", templateId: T, variationId: V });
    expect(input.source).toBe("upload");
    expect((await sharp(input.webp).metadata()).format).toBe("webp");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses non-images (even when labelled as PNG), missing files and bad ids", async () => {
    const svg = new Blob(["<svg onload=alert(1)/>"], { type: "image/png" });
    expect(await uploadFeatureImageAction(form({ templateId: T }, svg))).toEqual({
      ok: false,
      error: "Use a PNG, JPG or WebP image.",
    });
    expect((await uploadFeatureImageAction(form({ templateId: T }))).ok).toBe(false);
    expect((await uploadFeatureImageAction(form({ templateId: "x" }, svg))).ok).toBe(false);
    const huge = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    expect(await uploadFeatureImageAction(form({ templateId: T }, huge))).toEqual({
      ok: false,
      error: "Images can be at most 5 MB.",
    });
    expect(saveFeatureImage).not.toHaveBeenCalled();
  });
});

describe("removeFeatureImageAction", () => {
  it("removes the template image", async () => {
    removeFeatureImage.mockResolvedValueOnce({ ok: true, data: null });
    expect(await removeFeatureImageAction(form({ templateId: T }))).toEqual({
      ok: true,
      url: null,
    });
    expect(removeFeatureImage).toHaveBeenCalledWith({ kind: "template", templateId: T });
  });
});
