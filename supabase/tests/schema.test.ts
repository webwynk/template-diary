// @vitest-environment node
// Schema checks from DEVELOPMENT.md §5.7. Every check runs against the real migration SQL.
import type { PGlite } from "@electric-sql/pglite";

import { as, createTestDb, USER_A, USER_B } from "./harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
}, 30_000);

afterEach(async () => {
  await db.close();
});

async function createTemplate(
  userId: string,
  name = "Hero dark",
  tagIds: string[] = [],
  type: "custom" | "elementor" = "custom",
): Promise<string> {
  return as(db, userId, async () => {
    const res = await db.query<{ id: string }>(
      `select public.create_template($1, $2::public.template_type, $3, $4::uuid[]) as id`,
      [name, type, "<section>hi</section>", tagIds],
    );
    return res.rows[0]!.id;
  });
}

async function createTag(userId: string, name: string): Promise<string> {
  return as(db, userId, async () => {
    const res = await db.query<{ id: string }>(
      `insert into public.tags (name) values ($1) returning id`,
      [name],
    );
    return res.rows[0]!.id;
  });
}

async function addVariation(
  userId: string,
  templateId: string,
  name: string,
  parentId: string | null = null,
): Promise<string> {
  return as(db, userId, async () => {
    const res = await db.query<{ id: string }>(
      `insert into public.variations (template_id, name, content, parent_variation_id)
       values ($1, $2, $3, $4) returning id`,
      [templateId, name, "<section>changed</section>", parentId],
    );
    return res.rows[0]!.id;
  });
}

async function originalOf(templateId: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    `select id from public.variations where template_id = $1 and is_original`,
    [templateId],
  );
  return res.rows[0]!.id;
}

const TABLES = [
  "tags",
  "templates",
  "template_tags",
  "variations",
  "palette_presets",
  "user_settings",
  "text_labels",
];

describe("1. anonymous access", () => {
  it.each(TABLES)("anon cannot read public.%s", async (table) => {
    await createTemplate(USER_A);
    await expect(as(db, null, () => db.query(`select * from public.${table}`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("anon may call keep_alive() and nothing else changes for it", async () => {
    await createTemplate(USER_A);
    const res = await as(db, null, () =>
      db.query<{ alive: boolean }>(`select public.keep_alive() as alive`),
    );
    expect(res.rows).toEqual([{ alive: true }]);
    await expect(as(db, null, () => db.query(`select * from public.templates`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("anon cannot call create_template", async () => {
    await expect(
      as(db, null, () => db.query(`select public.create_template('x', 'custom', 'y')`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("2. users only see their own rows", () => {
  it("user B sees none of user A's rows and cannot change them", async () => {
    const templateId = await createTemplate(USER_A);
    await createTag(USER_A, "Hero");

    for (const table of TABLES) {
      const res = await as(db, USER_B, () => db.query(`select * from public.${table}`));
      expect(res.rows, table).toHaveLength(0);
    }

    const updated = await as(db, USER_B, () =>
      db.query(`update public.templates set name = 'hacked' where id = $1`, [templateId]),
    );
    expect(updated.affectedRows).toBe(0);
    const deleted = await as(db, USER_B, () =>
      db.query(`delete from public.templates where id = $1`, [templateId]),
    );
    expect(deleted.affectedRows).toBe(0);
  });

  it("a user cannot insert rows owned by someone else", async () => {
    await expect(
      as(db, USER_B, () =>
        db.query(`insert into public.tags (owner_id, name) values ($1, 'x')`, [USER_A]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a user cannot add a variation to someone else's template", async () => {
    const templateId = await createTemplate(USER_A);
    await expect(addVariation(USER_B, templateId, "sneaky")).rejects.toThrow(/foreign key/);
  });
});

describe("3. template_tags ownership", () => {
  it("linking another user's tag fails on the composite foreign key", async () => {
    const tagOfB = await createTag(USER_B, "B tag");
    const templateOfA = await createTemplate(USER_A);
    await expect(
      as(db, USER_A, () =>
        db.query(`insert into public.template_tags (template_id, tag_id) values ($1, $2)`, [
          templateOfA,
          tagOfB,
        ]),
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("4. one Original per template", () => {
  it("a second Original is rejected", async () => {
    const templateId = await createTemplate(USER_A);
    await expect(
      as(db, USER_A, () =>
        db.query(
          `insert into public.variations (template_id, name, is_original, content)
           values ($1, 'Second', true, 'x')`,
          [templateId],
        ),
      ),
    ).rejects.toThrow(/variations_one_original_uq/);
  });
});

describe("5. the Original is locked; other variations can be edited", () => {
  it("the Original's content cannot be updated", async () => {
    const templateId = await createTemplate(USER_A);
    const originalId = await originalOf(templateId);
    await expect(
      as(db, USER_A, () =>
        db.query(`update public.variations set content = 'new' where id = $1`, [originalId]),
      ),
    ).rejects.toThrow(/Original is locked/);
  });

  it("a variation's content can be saved in place by its owner only", async () => {
    const templateId = await createTemplate(USER_A);
    const variationId = await addVariation(USER_A, templateId, "Robo website section");
    await as(db, USER_A, () =>
      db.query(`update public.variations set content = 'edited' where id = $1`, [variationId]),
    );
    const res = await db.query<{ content: string }>(
      `select content from public.variations where id = $1`,
      [variationId],
    );
    expect(res.rows[0]?.content).toBe("edited");
    // RLS: another user's update matches no rows.
    await as(db, USER_B, () =>
      db.query(`update public.variations set content = 'hacked' where id = $1`, [variationId]),
    );
    const after = await db.query<{ content: string }>(
      `select content from public.variations where id = $1`,
      [variationId],
    );
    expect(after.rows[0]?.content).toBe("edited");
  });

  it("the Original cannot be renamed, trashed or deleted", async () => {
    const templateId = await createTemplate(USER_A);
    const originalId = await originalOf(templateId);
    await expect(
      as(db, USER_A, () =>
        db.query(`update public.variations set name = 'Renamed' where id = $1`, [originalId]),
      ),
    ).rejects.toThrow(/Original is locked/);
    await expect(
      as(db, USER_A, () =>
        db.query(`update public.variations set deleted_at = now() where id = $1`, [originalId]),
      ),
    ).rejects.toThrow(/Original is locked|check constraint/);
    const deleted = await as(db, USER_A, () =>
      db.query(`delete from public.variations where id = $1`, [originalId]),
    );
    expect(deleted.affectedRows).toBe(0);
  });

  it("a normal variation can be renamed and trashed", async () => {
    const templateId = await createTemplate(USER_A);
    const id = await addVariation(USER_A, templateId, "Green version");
    await as(db, USER_A, () =>
      db.query(`update public.variations set name = 'Green v2', deleted_at = now() where id = $1`, [
        id,
      ]),
    );
    const res = await db.query<{ name: string }>(
      `select name from public.variations where id = $1`,
      [id],
    );
    expect(res.rows[0]!.name).toBe("Green v2");
  });

  it("identity fields cannot change", async () => {
    const t1 = await createTemplate(USER_A, "One");
    const t2 = await createTemplate(USER_A, "Two");
    const id = await addVariation(USER_A, t1, "V");
    await expect(
      as(db, USER_A, () =>
        db.query(`update public.variations set template_id = $1 where id = $2`, [t2, id]),
      ),
    ).rejects.toThrow(/identity fields/);
  });
});

describe("6. template type is fixed", () => {
  it("changing type is rejected", async () => {
    const templateId = await createTemplate(USER_A);
    await expect(
      as(db, USER_A, () =>
        db.query(`update public.templates set type = 'elementor' where id = $1`, [templateId]),
      ),
    ).rejects.toThrow(/type cannot be changed/);
  });
});

describe("7. purging a template cascades", () => {
  it("deletes its variations (including the Original) and tag links", async () => {
    const tagId = await createTag(USER_A, "Hero");
    const templateId = await createTemplate(USER_A, "Hero dark", [tagId]);
    const v1 = await addVariation(USER_A, templateId, "V1");
    await addVariation(USER_A, templateId, "V2", v1);

    await as(db, USER_A, () =>
      db.query(`delete from public.templates where id = $1`, [templateId]),
    );

    const variations = await db.query(`select 1 from public.variations where template_id = $1`, [
      templateId,
    ]);
    const links = await db.query(`select 1 from public.template_tags where template_id = $1`, [
      templateId,
    ]);
    const tags = await db.query(`select 1 from public.tags where id = $1`, [tagId]);
    expect(variations.rows).toHaveLength(0);
    expect(links.rows).toHaveLength(0);
    expect(tags.rows).toHaveLength(1);
  });
});

describe("8. purging a parent variation", () => {
  it("nulls children's parent_variation_id and keeps owner_id", async () => {
    const templateId = await createTemplate(USER_A);
    const parent = await addVariation(USER_A, templateId, "Parent");
    const child = await addVariation(USER_A, templateId, "Child", parent);

    await as(db, USER_A, () => db.query(`delete from public.variations where id = $1`, [parent]));

    const res = await db.query<{ parent_variation_id: string | null; owner_id: string }>(
      `select parent_variation_id, owner_id from public.variations where id = $1`,
      [child],
    );
    expect(res.rows[0]).toEqual({ parent_variation_id: null, owner_id: USER_A });
  });
});

describe("9. variation names", () => {
  it("are unique per template ignoring case and spaces, among live variations", async () => {
    const templateId = await createTemplate(USER_A);
    const id = await addVariation(USER_A, templateId, "Robo website section");
    await expect(addVariation(USER_A, templateId, "  robo WEBSITE section ")).rejects.toThrow(
      /variations_name_uq/,
    );
    await as(db, USER_A, () =>
      db.query(`update public.variations set deleted_at = now() where id = $1`, [id]),
    );
    await expect(addVariation(USER_A, templateId, "Robo website section")).resolves.toBeTypeOf(
      "string",
    );
  });

  it("restoring is refused with 23505 when a live variation took the name meanwhile", async () => {
    const templateId = await createTemplate(USER_A);
    const id = await addVariation(USER_A, templateId, "Green");
    await as(db, USER_A, () =>
      db.query(`update public.variations set deleted_at = now() where id = $1`, [id]),
    );
    await addVariation(USER_A, templateId, "green");
    await expect(
      as(db, USER_A, () =>
        db.query(`update public.variations set deleted_at = null where id = $1`, [id]),
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("'Original' is reserved within a template", async () => {
    const templateId = await createTemplate(USER_A);
    await expect(addVariation(USER_A, templateId, "original")).rejects.toThrow(
      /variations_name_uq/,
    );
  });
});

describe("10. create_template", () => {
  it("creates 1 template, 1 Original and N tag links owned by the caller", async () => {
    const t1 = await createTag(USER_A, "Hero");
    const t2 = await createTag(USER_A, "Dark");
    const templateId = await createTemplate(USER_A, "  Hero dark  ", [t1, t2]);

    const template = await db.query<{ name: string; owner_id: string }>(
      `select name, owner_id from public.templates where id = $1`,
      [templateId],
    );
    const variations = await db.query<{ name: string; is_original: boolean; owner_id: string }>(
      `select name, is_original, owner_id from public.variations where template_id = $1`,
      [templateId],
    );
    const links = await db.query(`select 1 from public.template_tags where template_id = $1`, [
      templateId,
    ]);
    expect(template.rows[0]).toEqual({ name: "Hero dark", owner_id: USER_A });
    expect(variations.rows).toEqual([{ name: "Original", is_original: true, owner_id: USER_A }]);
    expect(links.rows).toHaveLength(2);
  });

  it("stores content byte for byte, with notes, used in and the detection summary", async () => {
    // Phase 4: Copy code / Download must return exactly what was saved.
    const content =
      "\uFEFF<section>\r\n\t<p class='x'>Café 👋  </p>\r\n</section>\n\n  " +
      '{"a":"https:\\/\\/x.test","b":"\\u00e9"}   ';
    const detected = {
      v: 1,
      colors: [{ rgb: "#4f46e5", count: 2 }],
      colorCount: 1,
      imageCount: 0,
      fonts: [],
      warningCount: 0,
    };
    const id = await as(db, USER_A, async () => {
      const res = await db.query<{ id: string }>(
        `select public.create_template($1, 'custom'::public.template_type, $2, '{}'::uuid[], $3, $4, $5::jsonb) as id`,
        ["Exact", content, "Some notes", "client-x.com", JSON.stringify(detected)],
      );
      return res.rows[0]!.id;
    });
    const template = await db.query<{ notes: string; used_in: string }>(
      `select notes, used_in from public.templates where id = $1`,
      [id],
    );
    const original = await db.query<{ content: string; detected: unknown; bytes: number }>(
      `select content, detected, octet_length(content) as bytes from public.variations where template_id = $1`,
      [id],
    );
    expect(template.rows[0]).toEqual({ notes: "Some notes", used_in: "client-x.com" });
    // PGlite's text decoder drops a leading BOM when reading rows back, so the BOM is checked
    // in SQL and the rest of the text compared as read.
    const bom = await db.query<{ bom: boolean }>(
      `select left(content, 1) = chr(65279) as bom from public.variations where template_id = $1`,
      [id],
    );
    expect(bom.rows[0]?.bom).toBe(true);
    expect(original.rows[0]?.content).toBe(content.slice(1));
    expect(original.rows[0]?.bytes).toBe(new TextEncoder().encode(content).length);
    expect(original.rows[0]?.detected).toEqual(detected);
  });

  it("rolls back completely when a tag id is invalid", async () => {
    const tagOfB = await createTag(USER_B, "B tag");
    await expect(createTemplate(USER_A, "Broken", [tagOfB])).rejects.toThrow(/foreign key/);
    const templates = await db.query(`select 1 from public.templates`);
    const variations = await db.query(`select 1 from public.variations`);
    expect(templates.rows).toHaveLength(0);
    expect(variations.rows).toHaveLength(0);
  });
});

describe("other constraints", () => {
  it("rejects empty variation content and a feature image path without a source", async () => {
    const templateId = await createTemplate(USER_A);
    await expect(
      as(db, USER_A, () =>
        db.query(
          `insert into public.variations (template_id, name, content) values ($1, 'Empty', '')`,
          [templateId],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(db, USER_A, () =>
        db.query(`update public.templates set feature_image_path = 'x.webp' where id = $1`, [
          templateId,
        ]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("creates user_settings with the agreed defaults (30-day trash)", async () => {
    const res = await as(db, USER_A, () =>
      db.query<{ default_device: number; trash_retention_days: number }>(
        `insert into public.user_settings default values
         returning default_device, trash_retention_days`,
      ),
    );
    expect(res.rows[0]).toEqual({ default_device: 1440, trash_retention_days: 30 });
  });

  it("updated_at moves forward on update", async () => {
    const templateId = await createTemplate(USER_A);
    const before = await db.query<{ updated_at: Date }>(
      `select updated_at from public.templates where id = $1`,
      [templateId],
    );
    await new Promise((r) => setTimeout(r, 10));
    await as(db, USER_A, () =>
      db.query(`update public.templates set is_favorite = true where id = $1`, [templateId]),
    );
    const after = await db.query<{ updated_at: Date }>(
      `select updated_at from public.templates where id = $1`,
      [templateId],
    );
    expect(after.rows[0]!.updated_at.getTime()).toBeGreaterThan(
      before.rows[0]!.updated_at.getTime(),
    );
  });
});

describe("storage policies", () => {
  it("a user can only write feature images inside their own folder", async () => {
    await as(db, USER_A, () =>
      db.query(`insert into storage.objects (bucket_id, name) values ('feature-images', $1)`, [
        `${USER_A}/t1/template-1.webp`,
      ]),
    );
    await expect(
      as(db, USER_A, () =>
        db.query(`insert into storage.objects (bucket_id, name) values ('feature-images', $1)`, [
          `${USER_B}/t1/template-1.webp`,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    const seenByB = await as(db, USER_B, () => db.query(`select * from storage.objects`));
    expect(seenByB.rows).toHaveLength(0);
  });

  it("the feature-images bucket is private with a 5 MB image-only limit", async () => {
    const res = await db.query(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'feature-images'`,
    );
    expect(res.rows[0]).toEqual({
      public: false,
      file_size_limit: 5242880,
      allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
    });
  });
});

describe("list_tags_with_counts", () => {
  it("counts only live templates and only the caller's tags", async () => {
    const hero = await createTag(USER_A, "Hero");
    const pricing = await createTag(USER_A, "pricing");
    await createTag(USER_B, "B only");
    await createTemplate(USER_A, "One", [hero]);
    await createTemplate(USER_A, "Two", [hero, pricing]);
    const trashed = await createTemplate(USER_A, "Three", [hero]);
    await as(db, USER_A, () =>
      db.query(`update public.templates set deleted_at = now() where id = $1`, [trashed]),
    );

    const res = await as(db, USER_A, () =>
      db.query<{ name: string; template_count: number }>(
        `select name, template_count::int as template_count from public.list_tags_with_counts()`,
      ),
    );
    // Sorted case-insensitively by name.
    expect(res.rows).toEqual([
      { name: "Hero", template_count: 2 },
      { name: "pricing", template_count: 1 },
    ]);
  });

  it("returns tags with zero templates", async () => {
    await createTag(USER_A, "Unused");
    const res = await as(db, USER_A, () =>
      db.query<{ template_count: number }>(
        `select template_count::int as template_count from public.list_tags_with_counts()`,
      ),
    );
    expect(res.rows).toEqual([{ template_count: 0 }]);
  });

  it("cannot be called by anon", async () => {
    await expect(
      as(db, null, () => db.query(`select * from public.list_tags_with_counts()`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("touch_template_on_variation", () => {
  it("saving a variation moves its template's updated_at forward", async () => {
    const templateId = await createTemplate(USER_A);
    // Skip triggers for this setup update, or set_updated_at would overwrite the old date.
    await db.exec(`set session_replication_role = replica`);
    await db.query(`update public.templates set updated_at = '2020-01-01' where id = $1`, [
      templateId,
    ]);
    await db.exec(`set session_replication_role = origin`);
    const before = await db.query<{ old: boolean }>(
      `select updated_at < now() - interval '1 day' as old from public.templates where id = $1`,
      [templateId],
    );
    expect(before.rows[0]?.old).toBe(true);
    await addVariation(USER_A, templateId, "Green version");
    const res = await db.query<{ old: boolean }>(
      `select updated_at < now() - interval '1 day' as old from public.templates where id = $1`,
      [templateId],
    );
    expect(res.rows[0]?.old).toBe(false);
  });

  it("editing a variation's content moves its template's updated_at forward", async () => {
    const templateId = await createTemplate(USER_A);
    const variationId = await addVariation(USER_A, templateId, "Green version");
    await db.exec(`set session_replication_role = replica`);
    await db.query(`update public.templates set updated_at = '2020-01-01' where id = $1`, [
      templateId,
    ]);
    await db.exec(`set session_replication_role = origin`);
    await as(db, USER_A, () =>
      db.query(`update public.variations set content = 'edited' where id = $1`, [variationId]),
    );
    const res = await db.query<{ old: boolean }>(
      `select updated_at < now() - interval '1 day' as old from public.templates where id = $1`,
      [templateId],
    );
    expect(res.rows[0]?.old).toBe(false);
  });

  it("cannot touch another user's template", async () => {
    const templateId = await createTemplate(USER_A);
    await expect(addVariation(USER_B, templateId, "Sneaky")).rejects.toThrow();
  });
});

describe("palette presets (Phase 8)", () => {
  async function createPreset(userId: string, name: string, colors: unknown): Promise<string> {
    return as(db, userId, async () => {
      const res = await db.query<{ id: string }>(
        `insert into public.palette_presets (name, colors) values ($1, $2::jsonb) returning id`,
        [name, JSON.stringify(colors)],
      );
      return res.rows[0]!.id;
    });
  }

  it("accepts {hex, label?} colors and refuses anything else", async () => {
    await expect(
      createPreset(USER_A, "Brand", [
        { hex: "#4f46e5", label: "Primary" },
        { hex: "#0f172a80" },
        { hex: "#ffffff", label: null },
      ]),
    ).resolves.toBeTypeOf("string");
    for (const bad of [
      [],
      [{ hex: "#FFF" }],
      [{ hex: "#ABCDEF" }],
      [{ hex: "red" }],
      [{ hex: "#ffffff", label: "x".repeat(41) }],
      [{ hex: "#ffffff", extra: 1 }],
      ["#ffffff"],
      Array.from({ length: 33 }, () => ({ hex: "#ffffff" })),
    ]) {
      await expect(createPreset(USER_A, `Bad ${JSON.stringify(bad).length}`, bad)).rejects.toThrow(
        /check constraint/,
      );
    }
  });

  it("names are unique per user ignoring case and spaces", async () => {
    await createPreset(USER_A, "Robo", [{ hex: "#000000" }]);
    await expect(createPreset(USER_A, "  ROBO ", [{ hex: "#000000" }])).rejects.toThrow(
      /palette_presets_owner_name_uq/,
    );
    await expect(createPreset(USER_B, "Robo", [{ hex: "#000000" }])).resolves.toBeTypeOf("string");
  });

  it("use_palette_preset counts uses for the owner only", async () => {
    const id = await createPreset(USER_A, "Robo", [{ hex: "#000000" }]);
    const use = (user: string) =>
      as(db, user, () =>
        db.query<{ n: number | null }>(`select public.use_palette_preset($1) as n`, [id]),
      );
    expect((await use(USER_A)).rows[0]!.n).toBe(1);
    expect((await use(USER_A)).rows[0]!.n).toBe(2);
    expect((await use(USER_B)).rows[0]!.n).toBeNull();
    const res = await db.query<{ use_count: number }>(
      `select use_count from public.palette_presets where id = $1`,
      [id],
    );
    expect(res.rows[0]!.use_count).toBe(2);
    await expect(
      as(db, null, () => db.query(`select public.use_palette_preset($1)`, [id])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("search_templates and duplicate_template (Phase 9)", () => {
  async function search(userId: string, q: string): Promise<string[]> {
    return as(db, userId, async () => {
      const res = await db.query<{ id: string }>(`select public.search_templates($1) as id`, [q]);
      return res.rows.map((r) => r.id).sort();
    });
  }

  it("finds live templates by name, notes, used in, variation names and tags", async () => {
    const tag = await createTag(USER_A, "Pricing");
    const a = await createTemplate(USER_A, "Hero dark");
    const b = await createTemplate(USER_A, "Footer", [tag]);
    const c = await createTemplate(USER_A, "Plain");
    await as(db, USER_A, () =>
      db.query(
        `update public.templates set notes = 'Robo agency', used_in = 'acme.com' where id = $1`,
        [c],
      ),
    );
    const v = await addVariation(USER_A, a, "Green 50% off");
    expect(await search(USER_A, "hero")).toEqual([a]);
    expect(await search(USER_A, "PRICING")).toEqual([b]);
    expect(await search(USER_A, "robo")).toEqual([c]);
    expect(await search(USER_A, "acme")).toEqual([c]);
    expect(await search(USER_A, "50%")).toEqual([a]);
    // % and _ are literal, not wildcards.
    expect(await search(USER_A, "%")).toEqual([a]);
    expect(await search(USER_A, "_")).toEqual([]);
    // Trashed variations and trashed templates don't match; other users see nothing.
    await as(db, USER_A, () =>
      db.query(`update public.variations set deleted_at = now() where id = $1`, [v]),
    );
    expect(await search(USER_A, "50%")).toEqual([]);
    await as(db, USER_A, () =>
      db.query(`update public.templates set deleted_at = now() where id = $1`, [a]),
    );
    expect(await search(USER_A, "hero")).toEqual([]);
    expect(await search(USER_B, "footer")).toEqual([]);
    await expect(
      as(db, null, () => db.query(`select public.search_templates('x')`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("duplicates a template with its tags and live variations, keeping parent links", async () => {
    const tag = await createTag(USER_A, "Hero");
    const src = await createTemplate(USER_A, "Hero dark", [tag]);
    const original = await originalOf(src);
    const green = await addVariation(USER_A, src, "Green", original);
    const greener = await addVariation(USER_A, src, "Greener", green);
    const trashed = await addVariation(USER_A, src, "Old", original);
    await as(db, USER_A, () =>
      db.query(`update public.variations set deleted_at = now() where id = $1`, [trashed]),
    );
    const copy = await as(db, USER_A, async () => {
      const res = await db.query<{ id: string }>(
        `select public.duplicate_template($1, '  Hero dark copy ') as id`,
        [src],
      );
      return res.rows[0]!.id;
    });
    const t = await db.query<{ name: string; owner_id: string; feature_image_source: string }>(
      `select name, owner_id, feature_image_source from public.templates where id = $1`,
      [copy],
    );
    expect(t.rows[0]).toEqual({
      name: "Hero dark copy",
      owner_id: USER_A,
      feature_image_source: "none",
    });
    const tags = await db.query(`select tag_id from public.template_tags where template_id = $1`, [
      copy,
    ]);
    expect(tags.rows).toEqual([{ tag_id: tag }]);
    const vs = await db.query<{
      id: string;
      name: string;
      is_original: boolean;
      parent: string | null;
      content: string;
    }>(
      `select v.id, v.name, v.is_original, p.name as parent, v.content
         from public.variations v left join public.variations p on p.id = v.parent_variation_id
        where v.template_id = $1 order by v.is_original desc, v.name`,
      [copy],
    );
    expect(vs.rows.map((r) => [r.name, r.is_original, r.parent])).toEqual([
      ["Original", true, null],
      ["Green", false, "Original"],
      ["Greener", false, "Green"],
    ]);
    expect(vs.rows.map((r) => r.id)).not.toContain(greener);
    expect(vs.rows[0]!.content).toBe("<section>hi</section>");

    // A copy of a copy (all rows share one created_at) still keeps the parent links.
    const copy2 = await as(db, USER_A, async () => {
      const res = await db.query<{ id: string }>(
        `select public.duplicate_template($1, 'x') as id`,
        [copy],
      );
      return res.rows[0]!.id;
    });
    const vs2 = await db.query<{ name: string; parent: string | null }>(
      `select v.name, p.name as parent from public.variations v
         left join public.variations p on p.id = v.parent_variation_id
        where v.template_id = $1 order by v.is_original desc, v.name`,
      [copy2],
    );
    expect(vs2.rows.map((r) => [r.name, r.parent])).toEqual([
      ["Original", null],
      ["Green", "Original"],
      ["Greener", "Green"],
    ]);
  });

  it("refuses trashed templates and other users' templates", async () => {
    const src = await createTemplate(USER_A, "Hero dark");
    await expect(
      as(db, USER_B, () => db.query(`select public.duplicate_template($1, 'x')`, [src])),
    ).rejects.toThrow(/Template not found/);
    await as(db, USER_A, () =>
      db.query(`update public.templates set deleted_at = now() where id = $1`, [src]),
    );
    await expect(
      as(db, USER_A, () => db.query(`select public.duplicate_template($1, 'x')`, [src])),
    ).rejects.toThrow(/Template not found/);
  });
});

describe("text_labels (Text tab T5)", () => {
  async function label(
    userId: string,
    templateId: string,
    kind: string,
    key: string,
    name: string,
  ) {
    return as(db, userId, () =>
      db.query(
        `insert into public.text_labels (template_id, kind, field_key, label)
         values ($1, $2, $3, $4)
         on conflict (template_id, kind, field_key) do update set label = excluded.label`,
        [templateId, kind, key, name],
      ),
    );
  }

  it("stores one name per group or field and template, upserted by its owner", async () => {
    const t = await createTemplate(USER_A);
    await label(USER_A, t, "field", "section[0]/h2[0]|text", "Main title");
    await label(USER_A, t, "group", "section[0]", "Hero");
    await label(USER_A, t, "field", "section[0]/h2[0]|text", "Big title");
    const rows = await as(db, USER_A, () =>
      db.query<{ kind: string; field_key: string; label: string; owner_id: string }>(
        `select kind, field_key, label, owner_id from public.text_labels order by kind`,
      ),
    );
    expect(rows.rows).toEqual([
      { kind: "field", field_key: "section[0]/h2[0]|text", label: "Big title", owner_id: USER_A },
      { kind: "group", field_key: "section[0]", label: "Hero", owner_id: USER_A },
    ]);
  });

  it("refuses bad names, kinds and keys", async () => {
    const t = await createTemplate(USER_A);
    for (const [kind, key, name] of [
      ["field", "k", ""],
      ["field", "k", "   "],
      ["field", "k", " padded "],
      ["field", "k", "x".repeat(61)],
      ["card", "k", "Name"],
      ["field", "", "Name"],
      ["field", "k".repeat(1001), "Name"],
    ]) {
      await expect(label(USER_A, t, kind!, key!, name!), `${kind} ${key} ${name}`).rejects.toThrow(
        /check constraint/,
      );
    }
    await expect(label(USER_A, t, "field", "k", "x".repeat(60))).resolves.toBeDefined();
  });

  it("keeps names private: other users can't read, add or change them", async () => {
    const t = await createTemplate(USER_A);
    await label(USER_A, t, "field", "k", "Mine");
    const seen = await as(db, USER_B, () => db.query(`select * from public.text_labels`));
    expect(seen.rows).toHaveLength(0);
    // Labelling someone else's template fails on the composite foreign key (or RLS on upsert).
    await expect(label(USER_B, t, "field", "other", "Theirs")).rejects.toThrow(
      /foreign key|row-level security/,
    );
    await expect(label(USER_B, t, "field", "k", "Hacked")).rejects.toThrow(
      /foreign key|row-level security/,
    );
    const changed = await as(db, USER_B, () =>
      db.query(`update public.text_labels set label = 'Hacked'`),
    );
    expect(changed.affectedRows).toBe(0);
    const deleted = await as(db, USER_B, () => db.query(`delete from public.text_labels`));
    expect(deleted.affectedRows).toBe(0);
    await expect(
      as(db, USER_B, () =>
        db.query(
          `insert into public.text_labels (owner_id, template_id, kind, field_key, label)
           values ($1, $2, 'field', 'x', 'Theirs')`,
          [USER_A, t],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("goes with its template: deleted on purge, copied by duplicate_template", async () => {
    const t = await createTemplate(USER_A);
    await label(USER_A, t, "group", "section[0]", "Hero");
    await label(USER_A, t, "field", "section[0]/h2[0]|text", "Big title");
    const copy = await as(db, USER_A, async () => {
      const res = await db.query<{ id: string }>(
        `select public.duplicate_template($1, 'Copy') as id`,
        [t],
      );
      return res.rows[0]!.id;
    });
    const copied = await db.query<{ kind: string; field_key: string; label: string }>(
      `select kind, field_key, label from public.text_labels where template_id = $1 order by kind`,
      [copy],
    );
    expect(copied.rows).toEqual([
      { kind: "field", field_key: "section[0]/h2[0]|text", label: "Big title" },
      { kind: "group", field_key: "section[0]", label: "Hero" },
    ]);
    await as(db, USER_A, () => db.query(`delete from public.templates where id = $1`, [t]));
    const left = await db.query(`select template_id from public.text_labels`);
    expect(left.rows).toEqual([{ template_id: copy }, { template_id: copy }]);
  });
});
