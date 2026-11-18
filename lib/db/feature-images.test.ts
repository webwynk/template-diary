// @vitest-environment node
import {
  featureImagePath,
  removeFeatureImage,
  saveFeatureImage,
  signFeatureImages,
} from "@/lib/db/feature-images";

vi.mock("server-only", () => ({}));

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
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })),
          error: null,
        }),
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

  it("signs each path once and skips empty ones", async () => {
    const urls = await signFeatureImages(["a.webp", null, "a.webp", "", undefined, "b.webp"]);
    expect([...urls.keys()]).toEqual(["a.webp", "b.webp"]);
  });
});
