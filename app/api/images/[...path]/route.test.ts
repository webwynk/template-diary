// @vitest-environment node
import { GET } from "@/app/api/images/[...path]/route";

const USER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const T = "0b6f0a52-3c1d-4e2f-8a9b-1c2d3e4f5a6b";

vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: USER, email: "e" }) }));
const readFeatureImage = vi.fn<(path: string) => Promise<Blob | null>>();
vi.mock("@/lib/db/feature-images", async (importOriginal) => ({
  FEATURE_IMAGE_PATH_RE: (await importOriginal<typeof import("@/lib/db/feature-images")>())
    .FEATURE_IMAGE_PATH_RE,
  readFeatureImage: (p: string) => readFeatureImage(p),
}));
vi.mock("server-only", () => ({}));

const get = (path: string) =>
  GET(new Request(`http://x/api/images/${path}`), {
    params: Promise.resolve({ path: path.split("/") }),
  } as never);

beforeEach(() => readFeatureImage.mockReset());

describe("GET /api/images/[...path]", () => {
  const mine = `${USER}/${T}/${T}-1763500000000.webp`;

  it("serves the owner's image with a long private browser cache", async () => {
    readFeatureImage.mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
    );
    const res = await get(mine);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(readFeatureImage).toHaveBeenCalledWith(mine);
  });

  it("refuses other users' files and anything that isn't a feature image name", async () => {
    for (const path of [
      `${OTHER}/${T}/${T}-1763500000000.webp`,
      `${USER}/${T}/../secret.webp`,
      `${USER}/${T}/${T}-1763500000000.png`,
      `${USER}/${T}`,
    ]) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(readFeatureImage).not.toHaveBeenCalled();
  });

  it("returns 404 (not cached) when the file is gone", async () => {
    readFeatureImage.mockResolvedValue(null);
    const res = await get(mine);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
