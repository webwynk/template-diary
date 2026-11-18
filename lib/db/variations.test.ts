// @vitest-environment node
import {
  ORIGINAL_LOCKED,
  renameVariation,
  restoreVariation,
  setVariationUsedIn,
  trashVariation,
} from "@/lib/db/variations";
import { VARIATION_NAME_TAKEN } from "@/lib/db/templates";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/feature-images", () => ({ featureImageUrls: () => new Map() }));

// One variation row with eq/is filters evaluated for real; `failNext` simulates a database error
// (a unique violation or the protect_variation trigger) on the next update.
type Row = Record<string, unknown>;
let row: Row | null;
let failNext: { code: string; message: string } | null;
const updates: Row[] = [];

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
      if (update && failNext) {
        const error = failNext;
        failNext = null;
        return resolve({ data: null, error });
      }
      const ok = matches();
      if (ok && update) {
        updates.push(update);
        Object.assign(row!, update);
      }
      resolve({ data: ok ? [{ id: row!.id }] : [], error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => query() }) }));

const ID = "var-1";
function variation(over: Row = {}): Row {
  return {
    id: ID,
    template_id: "tpl",
    name: "Green",
    is_original: false,
    deleted_at: null,
    used_in: null,
    ...over,
  };
}

beforeEach(() => {
  row = variation();
  failNext = null;
  updates.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the Original is refused before any write", () => {
  beforeEach(() => {
    row = variation({ name: "Original", is_original: true });
  });

  it("cannot be renamed", async () => {
    expect(await renameVariation(ID, "Hacked")).toEqual({ ok: false, error: ORIGINAL_LOCKED });
    expect(updates).toEqual([]);
  });

  it("cannot be trashed", async () => {
    expect(await trashVariation(ID)).toEqual({ ok: false, error: ORIGINAL_LOCKED });
    expect(updates).toEqual([]);
    expect(row!.deleted_at).toBeNull();
  });

  it("can have a “used in” note", async () => {
    expect(await setVariationUsedIn(ID, "robo.com")).toEqual({ ok: true, data: null });
    expect(row!.used_in).toBe("robo.com");
  });
});

describe("renameVariation", () => {
  it("renames a live variation", async () => {
    expect(await renameVariation(ID, "Green v2")).toEqual({ ok: true, data: null });
    expect(row!.name).toBe("Green v2");
  });

  it("maps a name clash to a clear message", async () => {
    failNext = { code: "23505", message: "duplicate key value violates variations_name_uq" };
    expect(await renameVariation(ID, "Blue")).toEqual({ ok: false, error: VARIATION_NAME_TAKEN });
  });

  it("refuses trashed and missing variations", async () => {
    row = variation({ deleted_at: "2026-11-18T00:00:00Z" });
    expect(await renameVariation(ID, "X")).toEqual({
      ok: false,
      error: "This variation no longer exists.",
    });
    row = null;
    expect((await renameVariation(ID, "X")).ok).toBe(false);
  });

  it("does not leak a database error from the trigger", async () => {
    failNext = { code: "P0001", message: "The Original is locked" };
    expect(await renameVariation(ID, "X")).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
  });
});

describe("trash and restore", () => {
  it("trashes, is idempotent, and restores", async () => {
    expect(await trashVariation(ID)).toEqual({ ok: true, data: null });
    expect(row!.deleted_at).toEqual(expect.any(String));
    expect(await trashVariation(ID)).toEqual({ ok: true, data: null });
    expect(updates).toHaveLength(1);
    expect(await restoreVariation(ID)).toEqual({ ok: true, data: null });
    expect(row!.deleted_at).toBeNull();
    expect(await restoreVariation(ID)).toEqual({ ok: true, data: null });
    expect(updates).toHaveLength(2);
  });

  it("explains a restore blocked by a name taken meanwhile", async () => {
    row = variation({ deleted_at: "2026-11-18T00:00:00Z" });
    failNext = { code: "23505", message: "variations_name_uq" };
    expect(await restoreVariation(ID)).toEqual({
      ok: false,
      error: "Another variation is already called “Green”. Rename that one first, then restore.",
    });
  });
});
