// @vitest-environment node
import {
  duplicateAsTemplateAction,
  renameVariationAction,
  restoreVariationAction,
  setVariationUsedInAction,
  trashVariationAction,
} from "@/actions/variations";
import { ORIGINAL_LOCKED } from "@/lib/db/variations";

// The actions run against the real lib/db/variations with a fake Supabase client, so these are
// "direct calls" that bypass the UI (DEVELOPMENT.md Phase 7). The database trigger itself is
// covered by supabase/tests/schema.test.ts.
const refresh = vi.fn();
const createTemplate = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u", email: "e" })) }));
vi.mock("@/lib/db/templates", () => ({
  createTemplate: (...args: unknown[]) => createTemplate(...args),
  VARIATION_NAME_TAKEN: "This template already has a variation with that name.",
}));

type Row = Record<string, unknown>;
let row: Row | null;
const writes: Row[] = [];
function query() {
  const filters: [string, unknown][] = [];
  let update: Row | null = null;
  const matches = () => row !== null && filters.every(([col, value]) => row![col] === value);
  const builder = {
    select: () => builder,
    update: (values: Row) => ((update = values), builder),
    eq: (col: string, value: unknown) => (filters.push([col, value]), builder),
    is: (col: string, value: unknown) => (filters.push([col, value]), builder),
    maybeSingle: async () => ({ data: matches() ? { ...row } : null, error: null }),
    then: (resolve: (r: unknown) => void) => {
      const ok = matches();
      if (ok && update) {
        writes.push(update);
        Object.assign(row!, update);
      }
      resolve({ data: ok ? [{ id: row!.id }] : [], error: null });
    },
  };
  return builder;
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => query() }) }));

const V = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";
const TAG = "4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f";
const NEW_T = "0b6f0a52-3c1d-4e2f-8a9b-1c2d3e4f5a6b";

function original(): Row {
  return {
    id: V,
    name: "Original",
    is_original: true,
    deleted_at: null,
    used_in: null,
    content: "<p>Hi</p>",
    detected: { colors: [], images: [], fonts: [] },
    templates: {
      name: "Hero dark",
      type: "custom",
      notes: "Agency hero",
      deleted_at: null,
      template_tags: [{ tag_id: TAG }],
    },
  };
}

beforeEach(() => {
  row = original();
  writes.length = 0;
  refresh.mockReset();
  createTemplate.mockReset();
});

describe("the Original through the actions", () => {
  it("cannot be renamed or trashed, and nothing is written", async () => {
    expect(await renameVariationAction(V, "Hacked")).toEqual({ ok: false, error: ORIGINAL_LOCKED });
    expect(await trashVariationAction(V)).toEqual({ ok: false, error: ORIGINAL_LOCKED });
    expect(writes).toEqual([]);
    expect(row).toMatchObject({ name: "Original", deleted_at: null });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("can get a “used in” note; blank clears it", async () => {
    expect(await setVariationUsedInAction(V, "  robo.com ")).toEqual({ ok: true });
    expect(row!.used_in).toBe("robo.com");
    expect(await setVariationUsedInAction(V, "   ")).toEqual({ ok: true });
    expect(row!.used_in).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe("other variations", () => {
  beforeEach(() => {
    row = { ...original(), name: "Green", is_original: false };
  });

  it("rename, trash and restore", async () => {
    expect(await renameVariationAction(V, "  Green v2 ")).toEqual({ ok: true });
    expect(row!.name).toBe("Green v2");
    expect(await trashVariationAction(V)).toEqual({ ok: true });
    expect(row!.deleted_at).toEqual(expect.any(String));
    expect(await restoreVariationAction(V)).toEqual({ ok: true });
    expect(row!.deleted_at).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("validates input before touching the database", async () => {
    expect((await renameVariationAction(V, "   ")).ok).toBe(false);
    expect((await renameVariationAction(V, "x".repeat(121))).ok).toBe(false);
    expect((await renameVariationAction("not-a-uuid", "Blue")).ok).toBe(false);
    expect((await trashVariationAction(42)).ok).toBe(false);
    expect((await restoreVariationAction(undefined)).ok).toBe(false);
    expect((await setVariationUsedInAction(V, "x".repeat(2001))).ok).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe("duplicateAsTemplateAction", () => {
  it("creates a template from the variation's exact code with the source's tags and notes", async () => {
    createTemplate.mockResolvedValueOnce({ ok: true, data: { id: NEW_T } });
    expect(await duplicateAsTemplateAction(V, " Hero dark copy ")).toEqual({
      ok: true,
      id: NEW_T,
      type: "custom",
    });
    const [details, content, detected] = createTemplate.mock.calls[0]!;
    expect(details).toMatchObject({
      name: "Hero dark copy",
      type: "custom",
      tagIds: [TAG],
      notes: "Agency hero",
    });
    expect(content).toBe("<p>Hi</p>");
    expect(detected).toEqual({ colors: [], images: [], fonts: [] });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses an empty name, a trashed variation and a trashed template", async () => {
    expect((await duplicateAsTemplateAction(V, "")).ok).toBe(false);
    row = { ...original(), deleted_at: "2026-11-18T00:00:00Z" };
    expect(await duplicateAsTemplateAction(V, "Copy")).toEqual({
      ok: false,
      error: "This variation no longer exists.",
    });
    row = original();
    (row.templates as Row).deleted_at = "2026-11-18T00:00:00Z";
    expect((await duplicateAsTemplateAction(V, "Copy")).ok).toBe(false);
    expect(createTemplate).not.toHaveBeenCalled();
  });
});
