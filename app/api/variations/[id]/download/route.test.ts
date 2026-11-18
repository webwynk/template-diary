// @vitest-environment node
import { GET } from "./route";

const getVariationContent = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u", email: "e" })) }));
vi.mock("@/lib/db/templates", () => ({
  getVariationContent: (id: string) => getVariationContent(id),
}));

const ID = "4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/variations/[id]/download", () => {
  it("returns the saved content byte for byte as an attachment", async () => {
    const content = '{"content":[],"title":"Caf\\u00e9 \\/ x"}\r\n  ';
    getVariationContent.mockResolvedValueOnce({
      ok: true,
      data: { content, variationName: "Original", templateName: "Hero dark", type: "elementor" },
    });
    const res = await GET(new Request("http://x"), ctx(ID));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new TextEncoder().encode(content));
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="hero-dark-original.json"',
    );
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(getVariationContent).toHaveBeenCalledWith(ID);
  });

  it("404s for bad ids and missing variations, 500s on database errors", async () => {
    expect((await GET(new Request("http://x"), ctx("../etc"))).status).toBe(404);
    getVariationContent.mockResolvedValueOnce({ ok: true, data: null });
    expect((await GET(new Request("http://x"), ctx(ID))).status).toBe(404);
    getVariationContent.mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    expect((await GET(new Request("http://x"), ctx(ID))).status).toBe(500);
  });
});
