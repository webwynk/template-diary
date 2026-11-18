// @vitest-environment node
import { getEditorData, listTemplates } from "@/lib/db/templates";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/feature-images", () => ({ signFeatureImages: async () => new Map() }));

// Speed audit P3: independent queries start together. Each fake query resolves after a short
// delay and records when it started, so the tests can tell parallel from one-after-another.
type Result = { data: unknown; error: { code?: string; message: string } | null };
let started: string[];
let pending: number;
let maxPending: number;
let results: Record<string, Result>;

function delayed(name: string): Promise<Result> {
  started.push(name);
  pending += 1;
  maxPending = Math.max(maxPending, pending);
  return new Promise((resolve) =>
    setTimeout(() => {
      pending -= 1;
      resolve(results[name] ?? { data: null, error: null });
    }, 5),
  );
}

function query(table: string) {
  const filters: string[] = [];
  const builder = {
    select: () => builder,
    eq: (col: string, value: unknown) => (filters.push(`${col}=${String(value)}`), builder),
    is: () => builder,
    order: () => builder,
    maybeSingle: () =>
      delayed(table === "variations" ? `variations ${filters.join(" ")}` : `${table} single`),
    then: (resolve: (r: Result) => void, reject: (e: unknown) => void) =>
      delayed(`${table} list`).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => query(table),
    rpc: (name: string) => delayed(`rpc ${name}`),
  }),
}));

beforeEach(() => {
  started = [];
  pending = 0;
  maxPending = 0;
  results = {};
});

function templateRow(id: string, name: string) {
  return {
    id,
    name,
    type: "custom",
    notes: null,
    used_in: null,
    is_favorite: false,
    feature_image_path: null,
    created_at: "2026-11-18T00:00:00Z",
    updated_at: "2026-11-18T00:00:00Z",
    template_tags: [],
    variations: [{ deleted_at: null }],
  };
}

describe("listTemplates", () => {
  it("runs the text search and the template query at the same time, then intersects", async () => {
    results["templates list"] = {
      data: [templateRow("a", "Hero"), templateRow("b", "Footer"), templateRow("c", "Pricing")],
      error: null,
    };
    results["rpc search_templates"] = { data: ["c", "a"], error: null };
    const r = await listTemplates({ q: "he" });
    expect(maxPending).toBe(2);
    expect(r.ok && r.data.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("makes no search call without a query", async () => {
    results["templates list"] = { data: [templateRow("a", "Hero")], error: null };
    const r = await listTemplates({});
    expect(started).toEqual(["templates list"]);
    expect(r.ok && r.data).toHaveLength(1);
  });

  it("reports a failed search", async () => {
    results["templates list"] = { data: [], error: null };
    results["rpc search_templates"] = { data: null, error: { message: "boom" } };
    expect((await listTemplates({ q: "x" })).ok).toBe(false);
  });
});

describe("getEditorData", () => {
  const variations = [
    {
      id: "orig",
      name: "Original",
      is_original: true,
      parent_variation_id: null,
      detected: {},
      changes: [],
      feature_image_path: null,
      deleted_at: null,
      created_at: "2026-11-18T00:00:00Z",
      updated_at: "2026-11-18T00:00:00Z",
    },
  ];

  it("loads the template and the Original's content at the same time", async () => {
    results["templates single"] = {
      data: { id: "t", name: "Hero", type: "custom", feature_image_path: null, variations },
      error: null,
    };
    results["variations template_id=t is_original=true"] = {
      data: { id: "orig", content: "<p>hi</p>" },
      error: null,
    };
    const r = await getEditorData("t");
    expect(maxPending).toBe(2);
    expect(r.ok && r.data?.base.content).toBe("<p>hi</p>");
  });

  it("asks for the requested base by id and returns null when it isn't a live variation", async () => {
    results["templates single"] = {
      data: { id: "t", name: "Hero", type: "custom", feature_image_path: null, variations },
      error: null,
    };
    const r = await getEditorData("t", "gone");
    expect(started).toContain("variations template_id=t id=gone");
    expect(r).toEqual({ ok: true, data: null });
  });
});
