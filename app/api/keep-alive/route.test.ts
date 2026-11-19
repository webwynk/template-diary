// @vitest-environment node
import { GET } from "@/app/api/keep-alive/route";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
const pingDatabase = vi.fn<() => Promise<{ ok: true } | { ok: false; error: string }>>();
vi.mock("@/lib/db/keep-alive", () => ({ pingDatabase: () => pingDatabase() }));

beforeEach(() => {
  pingDatabase.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/keep-alive", () => {
  it("answers 200 { ok: true } and is never cached", async () => {
    pingDatabase.mockResolvedValue({ ok: true });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("answers 503 without error details when the query fails", async () => {
    pingDatabase.mockResolvedValue({ ok: false, error: "secret detail" });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe(JSON.stringify({ ok: false }));
  });

  it("answers 503 when the client throws (e.g. missing env)", async () => {
    pingDatabase.mockRejectedValue(new Error("Missing env"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
  });
});
