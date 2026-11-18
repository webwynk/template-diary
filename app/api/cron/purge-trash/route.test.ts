// @vitest-environment node
import { GET } from "@/app/api/cron/purge-trash/route";

const findTrash = vi.fn();
const purge = vi.fn();
const settings = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => settings() }) }),
}));
vi.mock("@/lib/trash/purge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/trash/purge")>()),
  findTrash: (...a: unknown[]) => findTrash(...a),
  purge: (...a: unknown[]) => purge(...a),
}));

const SECRET = "a-long-enough-cron-secret";
const req = (auth?: string) =>
  new Request("http://x/api/cron/purge-trash", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  findTrash.mockReset();
  purge.mockReset();
  settings.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/purge-trash", () => {
  it("refuses requests without the right secret", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req(`Bearer ${SECRET}x`))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
    expect(findTrash).not.toHaveBeenCalled();
  });

  it("purges only items past each owner's retention", async () => {
    const old = { id: "old", ownerId: "u", deletedAt: "2020-01-01T00:00:00Z" };
    const recent = { id: "new", ownerId: "u", deletedAt: new Date().toISOString() };
    findTrash.mockResolvedValue({ ok: true, data: { templates: [old, recent], variations: [] } });
    settings.mockResolvedValue({
      data: [{ owner_id: "u", trash_retention_days: 30 }],
      error: null,
    });
    purge.mockResolvedValue({ templates: 1, variations: 0, failed: 0 });
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(purge.mock.calls[0]![1]).toEqual({ templates: [old], variations: [] });
    expect(await res.json()).toEqual({ templates: 1, variations: 0, failed: 0 });
  });
});
