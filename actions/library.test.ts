// @vitest-environment node
import {
  deleteForeverAction,
  duplicateTemplateAction,
  emptyTrashAction,
  restoreTemplateAction,
  searchTemplatesAction,
  setFavoriteAction,
  trashTemplateAction,
  updateTemplateDetailsAction,
} from "@/actions/library";

const db = {
  setFavorite: vi.fn(),
  trashTemplate: vi.fn(),
  restoreTemplate: vi.fn(),
  updateTemplateDetails: vi.fn(),
  duplicateTemplate: vi.fn(),
  deleteForever: vi.fn(),
};
const listTemplates = vi.fn();
const refresh = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u", email: "e" })) }));
vi.mock("@/lib/db/library", () => ({
  setFavorite: (...a: unknown[]) => db.setFavorite(...a),
  trashTemplate: (...a: unknown[]) => db.trashTemplate(...a),
  restoreTemplate: (...a: unknown[]) => db.restoreTemplate(...a),
  updateTemplateDetails: (...a: unknown[]) => db.updateTemplateDetails(...a),
  duplicateTemplate: (...a: unknown[]) => db.duplicateTemplate(...a),
  deleteForever: (...a: unknown[]) => db.deleteForever(...a),
}));
vi.mock("@/lib/db/templates", () => ({ listTemplates: (...a: unknown[]) => listTemplates(...a) }));

const ID = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";
const TAG = "4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f";
const OK = { ok: true, data: null };

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset());
  listTemplates.mockReset();
  refresh.mockReset();
});

describe("library actions", () => {
  it("favorite, trash and restore validate ids and refresh on success", async () => {
    db.setFavorite.mockResolvedValue(OK);
    db.trashTemplate.mockResolvedValue(OK);
    db.restoreTemplate.mockResolvedValue({ ok: false, error: "This template no longer exists." });
    expect(await setFavoriteAction(ID, true)).toEqual({ ok: true });
    expect(db.setFavorite).toHaveBeenCalledWith(ID, true);
    expect((await setFavoriteAction(ID, "yes")).ok).toBe(false);
    expect((await setFavoriteAction("x", true)).ok).toBe(false);
    expect(await trashTemplateAction(ID)).toEqual({ ok: true });
    expect((await restoreTemplateAction(ID)).ok).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("edit details trims, dedupes tags and ignores a type change", async () => {
    db.updateTemplateDetails.mockResolvedValue(OK);
    expect(
      await updateTemplateDetailsAction(ID, {
        name: "  Hero ",
        tagIds: [TAG, TAG],
        notes: "  ",
        usedIn: " acme.com ",
        type: "elementor",
      }),
    ).toEqual({ ok: true });
    expect(db.updateTemplateDetails).toHaveBeenCalledWith(ID, {
      name: "Hero",
      tagIds: [TAG],
      notes: null,
      usedIn: "acme.com",
    });
    expect((await updateTemplateDetailsAction(ID, { name: "", tagIds: [] })).ok).toBe(false);
  });

  it("duplicate validates the name and returns the new id and type", async () => {
    db.duplicateTemplate.mockResolvedValue({ ok: true, data: { id: "new", type: "custom" } });
    expect(await duplicateTemplateAction(ID, "Hero copy")).toEqual({
      ok: true,
      id: "new",
      type: "custom",
    });
    expect((await duplicateTemplateAction(ID, "x".repeat(121))).ok).toBe(false);
    expect(db.duplicateTemplate).toHaveBeenCalledOnce();
  });

  it("delete permanently accepts only a kind and an id; empty trash deletes everything", async () => {
    db.deleteForever.mockResolvedValue({
      ok: true,
      data: { templates: 1, variations: 0, failed: 0 },
    });
    expect(await deleteForeverAction({ kind: "variation", id: ID })).toEqual({ ok: true });
    expect(db.deleteForever).toHaveBeenLastCalledWith({ kind: "variation", id: ID });
    expect((await deleteForeverAction({ kind: "tag", id: ID })).ok).toBe(false);
    expect((await deleteForeverAction("all")).ok).toBe(false);
    expect(await emptyTrashAction()).toEqual({ ok: true });
    expect(db.deleteForever).toHaveBeenLastCalledWith("all");
  });

  it("search returns at most 8 hits and nothing for a blank query", async () => {
    listTemplates.mockResolvedValue({
      ok: true,
      data: Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, name: `T${i}`, type: "custom" })),
    });
    const r = await searchTemplatesAction(" hero ");
    expect(r.ok && r.hits).toHaveLength(8);
    expect(listTemplates).toHaveBeenCalledWith({ q: "hero" });
    expect(await searchTemplatesAction("  ")).toEqual({ ok: true, hits: [] });
    expect(listTemplates).toHaveBeenCalledOnce();
  });
});
