// @vitest-environment node
import { savePreferencesAction } from "@/actions/settings";

const savePreferences = vi.fn();
const refresh = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u", email: "e" })) }));
vi.mock("@/lib/db/settings", () => ({
  savePreferences: (...a: unknown[]) => savePreferences(...a),
}));

beforeEach(() => {
  savePreferences.mockReset();
  refresh.mockReset();
});

describe("savePreferencesAction", () => {
  it("saves valid preferences for the signed-in user and refreshes", async () => {
    savePreferences.mockResolvedValue({ ok: true, data: null });
    const r = await savePreferencesAction({ defaultDevice: 768, defaultFeatureMode: "upload" });
    expect(r).toEqual({ ok: true });
    expect(savePreferences).toHaveBeenCalledWith("u", {
      defaultDevice: 768,
      defaultFeatureMode: "upload",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it.each([
    { defaultDevice: 1024, defaultFeatureMode: "auto" },
    { defaultDevice: 1440, defaultFeatureMode: "none" },
    { defaultDevice: "1440", defaultFeatureMode: "auto" },
    null,
  ])("refuses values the database would reject: %j", async (input) => {
    const r = await savePreferencesAction(input);
    expect(r.ok).toBe(false);
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it("passes a database error through without refreshing", async () => {
    savePreferences.mockResolvedValue({ ok: false, error: "Something went wrong." });
    const r = await savePreferencesAction({ defaultDevice: 375, defaultFeatureMode: "auto" });
    expect(r).toEqual({ ok: false, error: "Something went wrong." });
    expect(refresh).not.toHaveBeenCalled();
  });
});
