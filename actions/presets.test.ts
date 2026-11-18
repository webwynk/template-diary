// @vitest-environment node
import {
  countPresetUseAction,
  createPresetAction,
  deletePresetAction,
  duplicatePresetAction,
  updatePresetAction,
} from "@/actions/presets";

const db = {
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
  getPreset: vi.fn(),
  deletePreset: vi.fn(),
  countPresetUse: vi.fn(),
};
const refresh = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u", email: "e" })) }));
vi.mock("@/lib/db/presets", () => ({
  PRESET_NAME_TAKEN: "You already have a palette with this name.",
  createPreset: (...a: unknown[]) => db.createPreset(...a),
  updatePreset: (...a: unknown[]) => db.updatePreset(...a),
  getPreset: (...a: unknown[]) => db.getPreset(...a),
  deletePreset: (...a: unknown[]) => db.deletePreset(...a),
  countPresetUse: (...a: unknown[]) => db.countPresetUse(...a),
  listPresets: vi.fn(),
}));

const ID = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";
const TAKEN = { ok: false, error: "You already have a palette with this name." };

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset());
  refresh.mockReset();
});

describe("preset actions", () => {
  it("create validates and normalizes before the database", async () => {
    db.createPreset.mockResolvedValueOnce({ ok: true, data: { id: ID, name: "Robo" } });
    const r = await createPresetAction({ name: " Robo ", colors: [{ hex: "4F46E5" }] });
    expect(r.ok).toBe(true);
    expect(db.createPreset).toHaveBeenCalledWith({
      name: "Robo",
      colors: [{ hex: "#4f46e5", label: null }],
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(await createPresetAction({ name: "Robo", colors: [{ hex: "nope" }] })).toEqual({
      ok: false,
      error: "“nope” is not a hex color like #4f46e5.",
    });
    expect(db.createPreset).toHaveBeenCalledOnce();
  });

  it("update and delete refuse bad ids and pass database errors through", async () => {
    expect((await updatePresetAction("x", { name: "A", colors: [{ hex: "#fff" }] })).ok).toBe(
      false,
    );
    expect((await deletePresetAction(1)).ok).toBe(false);
    db.updatePreset.mockResolvedValueOnce(TAKEN);
    expect(await updatePresetAction(ID, { name: "A", colors: [{ hex: "#fff" }] })).toEqual(TAKEN);
    db.deletePreset.mockResolvedValueOnce({ ok: true, data: null });
    expect(await deletePresetAction(ID)).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("duplicate picks the first free “copy” name", async () => {
    db.getPreset.mockResolvedValueOnce({
      ok: true,
      data: { id: ID, name: "Robo", colors: [{ hex: "#000000", label: null }] },
    });
    db.createPreset
      .mockResolvedValueOnce(TAKEN)
      .mockResolvedValueOnce(TAKEN)
      .mockResolvedValueOnce({ ok: true, data: {} });
    expect(await duplicatePresetAction(ID)).toEqual({ ok: true });
    expect(db.createPreset.mock.calls.map((c) => (c[0] as { name: string }).name)).toEqual([
      "Robo copy",
      "Robo copy 2",
      "Robo copy 3",
    ]);
  });

  it("duplicate stops on other errors and on a missing palette", async () => {
    db.getPreset.mockResolvedValueOnce({ ok: true, data: null });
    expect((await duplicatePresetAction(ID)).ok).toBe(false);
    db.getPreset.mockResolvedValueOnce({
      ok: true,
      data: { id: ID, name: "Robo", colors: [{ hex: "#000000", label: null }] },
    });
    db.createPreset.mockResolvedValueOnce({ ok: false, error: "Something went wrong." });
    expect(await duplicatePresetAction(ID)).toEqual({ ok: false, error: "Something went wrong." });
    expect(db.createPreset).toHaveBeenCalledOnce();
  });

  it("counts a use without refreshing the editor", async () => {
    db.countPresetUse.mockResolvedValueOnce({ ok: true, data: null });
    expect(await countPresetUseAction(ID)).toEqual({ ok: true });
    expect(refresh).not.toHaveBeenCalled();
  });
});
