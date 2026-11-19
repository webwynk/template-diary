// @vitest-environment node
import { listTextLabels, setTextLabel } from "@/lib/db/text-labels";

vi.mock("server-only", () => ({}));

// Records each call chain; `result` is what the awaited query resolves to.
const calls: unknown[][] = [];
let result: { data: unknown; error: { code?: string; message: string } | null };

function query() {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "delete", "upsert"]) {
    builder[m] = (...args: unknown[]) => (calls.push([m, ...args]), builder);
  }
  builder.then = (resolve: (r: unknown) => void) => resolve(result);
  return builder;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (t: string) => (calls.push(["from", t]), query()) }),
}));

beforeEach(() => {
  calls.length = 0;
  result = { data: null, error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("text labels data", () => {
  it("lists a template's names by kind and key", async () => {
    result = {
      data: [
        { kind: "group", field_key: "section[0]", label: "Hero" },
        { kind: "field", field_key: "section[0]/h2[0]|text", label: "Big title" },
        { kind: "other", field_key: "x", label: "ignored" },
      ],
      error: null,
    };
    expect(await listTextLabels("tpl")).toEqual({
      ok: true,
      data: { group: { "section[0]": "Hero" }, field: { "section[0]/h2[0]|text": "Big title" } },
    });
    expect(calls).toContainEqual(["eq", "template_id", "tpl"]);
  });

  it("upserts a name, and deletes the row for an empty name", async () => {
    expect(await setTextLabel("tpl", { kind: "field", key: "k", label: "Name" })).toEqual({
      ok: true,
      data: null,
    });
    expect(calls).toContainEqual([
      "upsert",
      { template_id: "tpl", kind: "field", field_key: "k", label: "Name" },
      { onConflict: "template_id,kind,field_key" },
    ]);
    calls.length = 0;
    await setTextLabel("tpl", { kind: "group", key: "g", label: "" });
    expect(calls.map((c) => c[0])).toEqual(["from", "delete", "eq", "eq", "eq"]);
    expect(calls).toContainEqual(["eq", "kind", "group"]);
  });

  it("turns database errors into sentences", async () => {
    result = { data: null, error: { code: "23503", message: "fk" } };
    expect(await setTextLabel("tpl", { kind: "field", key: "k", label: "x" })).toEqual({
      ok: false,
      error: "This template no longer exists.",
    });
    result = { data: null, error: { code: "XX000", message: "boom" } };
    expect(await listTextLabels("tpl")).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
    expect(await setTextLabel("tpl", { kind: "field", key: "k", label: "" })).toMatchObject({
      ok: false,
    });
  });
});
