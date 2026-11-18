// @vitest-environment node
import {
  featureImagePath,
  removeFeatureImage,
  saveFeatureImage,
  featureImageUrls,
  FEATURE_IMAGE_PATH_RE,
} from "@/lib/db/feature-images";

vi.mock("server-only", () => ({}));

const OWNER = "11111111-2222-4333-8444-555555555555";
const TPL = "0b6f0a52-3c1d-4e2f-8a9b-1c2d3e4f5a6b";
const VAR = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";

// A tiny in-memory stand-in for the Supabase client: one template row and one variation row,
// with eq/is filters evaluated for real so the compare-and-swap updates are exercised.
type Row = Record<string, unknown>;
const db: { templates: Row; variations: Row } = { templates: {}, variations: {} };
const storage = { uploaded: [] as string[], removed: [] as string[], onUpload: () => {} };

function query(table: "templates" | "variations") {
  const filters: [string, "eq" | "is", unknown][] = [];
  let update: Row | null = null;
  const matches = () =>
    filters.every(([col, op, value]) =>
      op === "is" ? db[table][col] === value : db[table][col] === value,
    );
  const builder = {
    select: () => builder,
    update: (values: Row) => ((update = values), builder),
    eq: (col: string, value: unknown) => (filters.push([col, "eq", value]), builder),
    is: (col: string, value: unknown) => (filters.push([col, "is", value]), builder),
    maybeSingle: async () => ({ data: matches() ? db[table] : null, error: null }),
    then: (resolve: (r: unknown) => void) => {
      const ok = matches();
      if (ok && update) Object.assign(db[table], update);
      resolve({ data: ok ? [{ id: db[table].id }] : [], error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: "templates" | "variations") => query(table),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          storage.uploaded.push(path);
          storage.onUpload();
          return { error: null };
        },
        remove: async (paths: string[]) => (storage.removed.push(...paths), { error: null }),
      }),
    },
  }),
}));

const T = "tpl";
const template = { kind: "template", templateId: T } as const;
const webp = Buffer.from("webp");

beforeEach(() => {
  db.templates = {
    id: T,
    deleted_at: null,
    feature_image_path: null,
    feature_image_source: "none",
  };
  db.variations = { id: "var", template_id: T, deleted_at: null, feature_image_path: null };
  storage.uploaded = [];
  storage.removed = [];
  storage.onUpload = () => {};
});

describe("feature images in Storage", () => {
  it("names files {owner}/{template}/{template|variation}-{ms}.webp", () => {
    expect(featureImagePath("u", template, 5)).toBe("u/tpl/tpl-5.webp");
    expect(featureImagePath("u", { kind: "variation", templateId: T, variationId: "v" }, 5)).toBe(
      "u/tpl/v-5.webp",
    );
  });

  it("saves, then replaces and deletes the old file", async () => {
    const first = await saveFeatureImage({ ownerId: "u", target: template, webp, source: "auto" });
    expect(first.ok && first.data.saved).toBe(true);
    const firstPath = db.templates.feature_image_path as string;
    expect(db.templates.feature_image_source).toBe("auto");
    expect(storage.removed).toEqual([]);

    await new Promise((r) => setTimeout(r, 2)); // a later timestamp
    await saveFeatureImage({ ownerId: "u", target: template, webp, source: "upload" });
    expect(db.templates.feature_image_source).toBe("upload");
    expect(db.templates.feature_image_path).not.toBe(firstPath);
    expect(storage.removed).toEqual([firstPath]);
  });

  it("an automatic image never replaces an existing one", async () => {
    db.templates.feature_image_path = "u/tpl/uploaded.webp";
    db.templates.feature_image_source = "upload";
    const result = await saveFeatureImage({
      ownerId: "u",
      target: template,
      webp,
      source: "auto",
      onlyIfEmpty: true,
    });
    expect(result).toEqual({ ok: true, data: { saved: false } });
    expect(db.templates.feature_image_path).toBe("u/tpl/uploaded.webp");
    expect(storage.uploaded).toEqual([]);
  });

  it("removes the new file when the row changed in the meantime", async () => {
    // Another upload lands between our read and our update.
    storage.onUpload = () => {
      db.templates.feature_image_path = "u/tpl/other.webp";
      db.templates.feature_image_source = "upload";
    };
    const result = await saveFeatureImage({ ownerId: "u", target: template, webp, source: "auto" });
    expect(result.ok).toBe(false);
    expect(db.templates.feature_image_path).toBe("u/tpl/other.webp");
    expect(storage.removed).toEqual(storage.uploaded);
  });

  it("removes an image and its file; a variation falls back to the template image", async () => {
    db.variations.feature_image_path = "u/tpl/var-1.webp";
    const result = await removeFeatureImage({
      kind: "variation",
      templateId: T,
      variationId: "var",
    });
    expect(result.ok).toBe(true);
    expect(db.variations.feature_image_path).toBeNull();
    expect(storage.removed).toEqual(["u/tpl/var-1.webp"]);
  });

  it("builds stable /api/images links without any request, skipping empty and unknown paths", () => {
    const a = featureImagePath(OWNER, { kind: "template", templateId: TPL }, 1763500000000);
    const b = featureImagePath(
      OWNER,
      { kind: "variation", templateId: TPL, variationId: VAR },
      1763500000001,
    );
    const urls = featureImageUrls([a, null, a, "", undefined, b, "../etc/passwd", `${a}x`]);
    expect([...urls.entries()]).toEqual([
      [a, `/api/images/${a}`],
      [b, `/api/images/${b}`],
    ]);
  });

  it("accepts exactly the names featureImagePath() makes", () => {
    const ok = featureImagePath(OWNER, { kind: "template", templateId: TPL }, 1763500000000);
    expect(FEATURE_IMAGE_PATH_RE.test(ok)).toBe(true);
    for (const bad of [`${ok}/x`, ok.replace(".webp", ".png"), `x/${ok}`, ok.toUpperCase()]) {
      expect(FEATURE_IMAGE_PATH_RE.test(bad)).toBe(false);
    }
  });
});
