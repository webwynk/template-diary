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
];

describe("1. anonymous access", () => {
  it.each(TABLES)("anon cannot read public.%s", async (table) => {
    await createTemplate(USER_A);
    await expect(as(db, null, () => db.query(`select * from public.${table}`))).rejects.toThrow(
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

describe("5. variations are append-only and the Original is locked", () => {
  it("content of any variation cannot be updated", async () => {
    const templateId = await createTemplate(USER_A);
    const variationId = await addVariation(USER_A, templateId, "Robo website section");
    for (const id of [await originalOf(templateId), variationId]) {
      await expect(
        as(db, USER_A, () =>
          db.query(`update public.variations set content = 'new' where id = $1`, [id]),
        ),
      ).rejects.toThrow(/immutable/);
    }
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
