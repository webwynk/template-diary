// @vitest-environment node
import { expired, findTrash, purge, type TrashItems } from "@/lib/trash/purge";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/feature-images", () => ({ FEATURE_BUCKET: "feature-images" }));

// A recording fake: storage list/remove and table deletes, in call order.
function fakeClient(opts: { files?: Record<string, string[]>; failRemove?: boolean } = {}) {
  const log: string[] = [];
  const deleted: Record<string, string[]> = { templates: [], variations: [] };
  const client = {
    storage: {
      from: () => ({
        list: async (folder: string) => ({
          data: (opts.files?.[folder] ?? [])
            .map((name) => ({ id: name, name }))
            .concat([{ id: null as unknown as string, name: "subfolder" }]),
          error: null,
        }),
        remove: async (paths: string[]) => {
          log.push(`remove ${paths.join(",")}`);
          return opts.failRemove ? { error: { message: "boom" } } : { error: null };
        },
      }),
    },
    from: (table: "templates" | "variations") => {
      const b = {
        ids: [] as string[],
        delete: () => b,
        select: () => b,
        not: () => b,
        eq: () => b,
        in: (_c: string, ids: string[]) => ((b.ids = ids), b),
        then: (resolve: (r: unknown) => void) => {
          log.push(`delete ${table} ${b.ids.join(",")}`);
          deleted[table]!.push(...b.ids);
          resolve({ data: b.ids.map((id) => ({ id })), error: null });
        },
      };
      return b;
    },
  };
  return { client: client as never, log, deleted };
}

const ITEMS: TrashItems = {
  templates: [{ id: "t1", ownerId: "u1", deletedAt: "2026-10-01T00:00:00Z" }],
  variations: [
    {
      id: "v1",
      ownerId: "u1",
      templateId: "t9",
      featureImagePath: "u1/t9/v1-1.webp",
      deletedAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "v2",
      ownerId: "u1",
      templateId: "t9",
      featureImagePath: null,
      deletedAt: "2026-10-01T00:00:00Z",
    },
  ],
};

describe("purge", () => {
  it("removes every file in the template folder and variation images before the rows", async () => {
    const { client, log } = fakeClient({ files: { "u1/t1": ["t1-1.webp", "old-2.webp"] } });
    expect(await purge(client, ITEMS)).toEqual({ templates: 1, variations: 2, failed: 0 });
    expect(log).toEqual([
      "remove u1/t1/t1-1.webp,u1/t1/old-2.webp",
      "delete templates t1",
      "remove u1/t9/v1-1.webp",
      "delete variations v1,v2",
    ]);
  });

  it("keeps rows whose files couldn't be deleted (retried next time)", async () => {
    const { client, deleted } = fakeClient({ files: { "u1/t1": ["a.webp"] }, failRemove: true });
    expect(await purge(client, ITEMS)).toEqual({ templates: 0, variations: 0, failed: 3 });
    expect(deleted).toEqual({ templates: [], variations: [] });
  });

  it("does nothing for an empty trash", async () => {
    const { client, log } = fakeClient();
    expect(await purge(client, { templates: [], variations: [] })).toEqual({
      templates: 0,
      variations: 0,
      failed: 0,
    });
    expect(log).toEqual([]);
  });
});

describe("expired", () => {
  it("uses each owner's retention, 30 days by default", () => {
    const now = new Date("2026-11-18T00:00:00Z");
    const items: TrashItems = {
      templates: [
        { id: "old", ownerId: "a", deletedAt: "2026-10-18T00:00:00Z" },
        { id: "new", ownerId: "a", deletedAt: "2026-10-19T00:00:01Z" },
        { id: "short", ownerId: "b", deletedAt: "2026-11-16T00:00:00Z" },
      ],
      variations: [],
    };
    expect(expired(items, new Map([["b", 2]]), now).templates.map((t) => t.id)).toEqual([
      "old",
      "short",
    ]);
  });
});

describe("findTrash", () => {
  it("reports a read error without throwing", async () => {
    const failing = {
      from: () => {
        const b = {
          select: () => b,
          not: () => b,
          is: () => b,
          eq: () => b,
          then: (resolve: (r: unknown) => void) => resolve({ data: null, error: { message: "x" } }),
        };
        return b;
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await findTrash(failing as never)).ok).toBe(false);
  });
});
