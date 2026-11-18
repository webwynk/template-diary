# Template Diary — Development Plan (DEVELOPMENT.md)

> What we build, in which order, and how we know each phase is done.
> Read together with `DESIGN.md` (look & feel) and `RULES.md` (how we write code).
> **The database schema in §5 is the contract.** Code must match it exactly. Any schema change
> is a new migration file **and** an update to §5 in the same commit.

---

## 1. Product summary

Template Diary is a private, online library of website templates for one WordPress developer (Hasan).

- **Template** = name + type (**Custom** or **Elementor**) + tags + feature image + notes / "used in".
- **Custom** templates are **one combined code box** (HTML + CSS + JS together). They may load external CSS/JS from CDNs.
- **Elementor** templates are a single **section or page `.json` export**.
- On save, the app **auto-detects colors, image URLs and fonts**.
- **Global swap:** change one color and every occurrence (in any format) changes. Individual occurrences can be unticked.
- **Palette presets** are saved and reused with an old → new mapping.
- **Images** are replaced by pasting a link only (no uploads for template images).
- **Fonts** are swappable.
- **Live preview** (Custom only) at Desktop 1440 / Tablet 768 / Mobile 375. Elementor shows the swap list + feature image (no live render).
- The **Original is locked**. Every save creates a **manually named variation** (e.g. "Robo website section") in history, with **Copy Code** / **Download .json**. Any variation can be reopened or used as the base for a new one.
- Extras: favorites, "used in" notes, duplicate, trash / restore, full library backup export, search & filters.
- Single user, hosted online, login required. No public sign-up. Light theme only, Inter font everywhere.

---

## 2. Tech stack

| Area                      | Choice                                                                                                                                       | Why                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework                 | **Next.js 16 (App Router, Turbopack, Cache Components) + TypeScript (strict)**                                                               | Server Components, Server Actions, Route Handlers, first-class on Vercel |
| Styling                   | **Tailwind CSS v4 + shadcn/ui** (Radix, new-york style) + `lucide-react` icons                                                               | Matches DESIGN.md tokens, accessible primitives                          |
| Font                      | `next/font/google` → Inter (UI), JetBrains Mono (code only)                                                                                  | Self-hosted, no layout shift                                             |
| Database / Auth / Storage | **Supabase** (Postgres 15+, Auth email+password, Storage)                                                                                    | One service, Row Level Security                                          |
| Supabase client           | `@supabase/ssr` + `@supabase/supabase-js`, generated TS types                                                                                | Cookie-based sessions in App Router                                      |
| Code editor               | **Monaco** via `@monaco-editor/react`, served from our own domain (`public/monaco/<version>`, copied on install) (+ diff editor later)       | VS Code editing, HTML/JSON modes                                         |
| Preview                   | Sandboxed `<iframe srcdoc>`                                                                                                                  | Isolation of user JS from the app                                        |
| Parsing (engine)          | `parse5` (HTML with source locations), `postcss` + `postcss-safe-parser` + `postcss-value-parser` (CSS), `culori` (color parsing/conversion) | Accurate offsets, all color formats                                      |
| Validation                | **Zod** at every boundary (forms, server actions, route handlers, JSON imports)                                                              | Runtime safety + inferred types                                          |
| Forms                     | `react-hook-form` + `@hookform/resolvers/zod`                                                                                                |                                                                          |
| Data fetching (client)    | Server Components first; `@tanstack/react-query` only where client caching is needed (editor, library filters)                               |                                                                          |
| Color picker              | `react-colorful`                                                                                                                             | Tiny, accessible                                                         |
| Toasts                    | `sonner`                                                                                                                                     |                                                                          |
| Screenshots               | Route Handler with `puppeteer-core` + `@sparticuz/chromium`, `sharp` for WebP                                                                | Works on Vercel serverless                                               |
| Zip (backup)              | `archiver` (server, streamed)                                                                                                                | Streams large libraries                                                  |
| Tests                     | **Vitest** (unit, engine), **Playwright** (e2e), `@testing-library/react`                                                                    |                                                                          |
| Lint/format               | ESLint (next + typescript-eslint strict), Prettier, `tsc --noEmit`                                                                           |                                                                          |
| Hosting                   | **Vercel** (app + cron), Supabase cloud (DB)                                                                                                 |                                                                          |
| CI                        | GitHub Actions on every push to `main`: typecheck, lint, unit tests, build, e2e                                                              |                                                                          |

All versions in `package.json` are pinned exactly (no `^`). Next.js 16 differs from older Next.js: read the bundled guides in `node_modules/next/dist/docs/` before using an API (see `AGENTS.md`). Session handling uses `proxy.ts` (the Next 16 name for middleware).

shadcn/ui components are added with `node scripts/add-ui.mjs <name>` (copies the source from the shadcn GitHub repo and strips `dark:` classes), because the Claude cloud environment can't reach ui.shadcn.com. On a normal machine `npx shadcn@latest add <name>` also works.

---

## 3. Folder structure

```
template-diary/
├─ app/
│  ├─ (auth)/login/page.tsx
│  ├─ (app)/layout.tsx                 # app shell: sidebar + top bar, requires session
│  ├─ (app)/page.tsx                   # Library
│  ├─ (app)/favorites/page.tsx
│  ├─ (app)/palettes/page.tsx
│  ├─ (app)/trash/page.tsx
│  ├─ (app)/settings/{tags,account}/page.tsx   # /settings redirects to /settings/tags
│  ├─ (app)/templates/new/page.tsx
│  ├─ (app)/templates/[id]/page.tsx    # overview + variations
│  ├─ (editor)/templates/[id]/edit/page.tsx
│  ├─ api/variations/[id]/download/route.ts  # exact saved content as a file (auth checked)
│  ├─ api/screenshot/route.ts          # auto feature image
│  ├─ api/backup/route.ts              # zip export
│  ├─ api/cron/purge-trash/route.ts    # Vercel cron
│  └─ globals.css
├─ components/ui/                      # shadcn components (added via scripts/add-ui.mjs)
├─ components/                         # app components (library, editor, palette, …)
├─ lib/
│  ├─ engine/                          # PURE TS: detect + swap. No React, no Supabase.
│  │  ├─ index.ts                      # public API: detect, applySwaps, summarize
│  │  ├─ types.ts
│  │  ├─ colors.ts                     # parse / normalize / format colors
│  │  ├─ fonts.ts, text.ts, validate.ts
│  │  ├─ custom/detect.ts              # HTML+CSS detection with offsets
│  │  ├─ custom/apply.ts               # offset-based replacement
│  │  ├─ elementor/detect.ts           # JSON walk with paths
│  │  ├─ elementor/json-locate.ts      # exact text range of every JSON value
│  │  ├─ elementor/apply.ts            # in-place replacement in the JSON text
│  │  └─ __tests__/ + fixtures/
│  ├─ preview/build-srcdoc.ts          # wraps fragments, injects error bridge
│  ├─ supabase/{server,client,proxy}.ts
│  ├─ db/                              # typed query functions (one place for all SQL access)
│  ├─ validation/                      # Zod schemas
│  └─ utils/
├─ actions/                            # Server Actions (validated with Zod)
├─ supabase/
│  ├─ migrations/                      # timestamped .sql — the only way to change schema
│  ├─ seed.sql
│  └─ tests/                           # schema tests: RLS, constraints, triggers (Vitest + PGlite)
├─ types/database.ts                   # GENERATED by the Database GitHub Action — never edit by hand
├─ e2e/                                # Playwright
├─ DESIGN.md  DEVELOPMENT.md  RULES.md
└─ .env.example
```

---

## 4. Environment variables

| Name                            | Where           | Notes                                                                      |
| ------------------------------- | --------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client + server |                                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Safe to expose; RLS protects data                                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | **server only** | Used only by cron purge + backup if needed. Never imported in client code. |
| `ALLOWED_EMAIL`                 | server          | The single allowed account; `proxy.ts` rejects any other session           |
| `CRON_SECRET`                   | server          | Vercel cron auth header check                                              |

`.env.local` is git-ignored. `.env.example` lists names with empty values.

---

## 5. Database schema (Supabase / Postgres) — THE CONTRACT

### 5.1 Design decisions

- Every table has `owner_id uuid` → `auth.users(id)`, defaulting to `auth.uid()`. Even though there is one user, RLS on `owner_id` means a leaked anon key reveals nothing.
- Child tables use **composite foreign keys `(parent_id, owner_id)`** so the database itself guarantees a child can never point at another user's row (plain FKs bypass RLS).
- **The Original is locked.** Its `content`, name and trash state never change (trigger). Other variations can be edited and saved in place (Hasan's decision, 2026-11-18; migration 4); "Save as new" still inserts a new variation.
- **The Original** is the variation with `is_original = true`. Exactly one per template (partial unique index). It can't be renamed, trashed or edited (trigger).
- Templates and Originals are created together in one transaction by the `create_template` RPC.
- Content is stored as `text` (not `jsonb`) for **both** types, so Copy / Download returns exactly what was saved (jsonb would reorder keys and drop formatting). Elementor JSON is validated in the app before insert.
- Soft delete with `deleted_at`. Permanent purge is done by server code so Storage files are removed too.
- `detected` (jsonb) caches the detection summary for list views (swatch strips, counts). The editor always re-runs detection from `content`, so the cache can never cause wrong swaps.

### 5.2 Migrations (the SQL lives in `supabase/migrations/`)

The exact SQL is in the migration files; this section describes what they create. Applied migrations are never edited (RULES.md §3).

| File                                          | What it does                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `20261118000001_init.sql`                     | Everything below: enums, tables, indexes, triggers, `create_template`, privileges, RLS, storage bucket + policies  |
| `20261118000002_tag_counts.sql`               | `list_tags_with_counts()` (§5.3)                                                                                   |
| `20261118000003_touch_template.sql`           | Trigger `variations_touch_template`: a new variation sets its template's `updated_at` (library sort "last edited") |
| `20261118000004_editable_variations.sql`      | `protect_variation` locks only the Original's content; editing a variation's content also touches its template     |
| `20261118000005_palette_presets.sql`          | Check `palette_presets_colors_valid` on preset colors; `use_palette_preset(id)` (§5.3)                             |
| `20261118000006_library_search_duplicate.sql` | Trigram indexes for search; `search_templates(q)`, `duplicate_template(id, name)` (§5.3)                           |

**Enums:** `template_type` = `custom` \| `elementor`; `feature_image_source` = `none` \| `auto` \| `upload`.

**Tables** (all have `owner_id uuid` defaulting to `auth.uid()`, plus `created_at`/`updated_at` where listed; `updated_at` is set by the `set_updated_at` trigger):

| Table             | Columns (type, nullability, default)                                                                                                                                                                                                                                                                                                                         | Constraints & indexes                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tags`            | `id uuid pk`, `owner_id uuid → auth.users`, `name text` (1–40 chars), `color text` default `#64748B` (`#RRGGBB`), `created_at`, `updated_at`                                                                                                                                                                                                                 | unique `(id, owner_id)`; unique `(owner_id, lower(btrim(name)))`                                                                                                                                                                                                                                                                                                                                       |
| `templates`       | `id uuid pk`, `owner_id → auth.users`, `name text` (1–120), `type template_type`, `notes text null` (≤ 5000), `used_in text null` (≤ 2000), `is_favorite bool` default false, `feature_image_path text null`, `feature_image_source` default `none`, `deleted_at timestamptz null`, `created_at`, `updated_at`                                               | unique `(id, owner_id)`; check `feature_image_path is null ⇔ source = 'none'`; trigger: `type` can't change; indexes: live list, trash list, trigram on `name`                                                                                                                                                                                                                                         |
| `template_tags`   | `template_id uuid`, `tag_id uuid`, `owner_id uuid`, `created_at`                                                                                                                                                                                                                                                                                             | pk `(template_id, tag_id)`; composite FKs `(template_id, owner_id) → templates`, `(tag_id, owner_id) → tags`, both `on delete cascade`                                                                                                                                                                                                                                                                 |
| `variations`      | `id uuid pk`, `owner_id`, `template_id uuid`, `parent_variation_id uuid null`, `name text` (1–120), `is_original bool` default false, `content text` (1 B – 5 MB), `detected jsonb` (object) default `{}`, `changes jsonb` (array) default `[]`, `used_in text null` (≤ 2000), `feature_image_path text null`, `deleted_at null`, `created_at`, `updated_at` | unique `(id, owner_id)`; FK `(template_id, owner_id) → templates` cascade; FK `(parent_variation_id, owner_id) → variations` `on delete set null (parent_variation_id)`; check Original has no parent and is never trashed; **one Original per template** (partial unique); **live names unique per template** case/space-insensitive (so "Original" is reserved); trigger `protect_variation` (below) |
| `palette_presets` | `id uuid pk`, `owner_id → auth.users`, `name text` (1–60), `colors jsonb` array of 1–32 `{hex, label?}` (hex lowercase `#rrggbb`/`#rrggbbaa`, label ≤ 40 or null), `use_count int ≥ 0`, `created_at`, `updated_at`                                                                                                                                           | unique `(owner_id, lower(btrim(name)))`                                                                                                                                                                                                                                                                                                                                                                |
| `user_settings`   | `owner_id uuid pk → auth.users`, `default_device int` default 1440 (1440/768/375), `default_feature_mode` default `auto` (not `none`), `trash_retention_days int` default **30** (1–365), `last_backup_at null`, `updated_at`                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                        |

**`protect_variation` trigger** (before update on `variations`):

- The Original's `content` can never change; other variations' `content` can be overwritten ("Save changes").
- `template_id`, `is_original`, `owner_id` can never change; `parent_variation_id` may only change to `null` (the `set null` cascade when a parent is purged).
- The Original can't be renamed or trashed.

> **Cross-check notes:**
>
> - `on delete set null (parent_variation_id)` (column list) needs **Postgres 15+**; without the column list Postgres would also null `owner_id`. Supabase projects are 15+.
> - The `set null` cascade is an UPDATE on the child, so `protect_variation` fires and allows it (schema test 8).
> - Foreign-key cascades are not subject to RLS, so purging a template removes its Original even though the delete policy forbids deleting an Original directly (schema test 7).
> - All functions use `set search_path = ''` and fully qualified names (Supabase security linter). Policies use `(select auth.uid())` so Postgres evaluates it once per query.

### 5.3 RPC: `create_template`

`create_template(p_name, p_type, p_content, p_tag_ids uuid[] default '{}', p_notes default null, p_used_in default null, p_detected jsonb default '{}') returns uuid` — `security invoker` (RLS applies). In one transaction it inserts the template (name trimmed), its Original (`name = 'Original'`, `is_original = true`) and the tag links; any failure rolls everything back. Execute is granted to `authenticated` only. `duplicate_template(p_id, p_name) returns uuid` (Phase 9, `security invoker`) copies a live template (name trimmed, notes, used in), its tag links and all **live** variations in one transaction, parents before children so `parent_variation_id` points at the copies (a trashed parent leaves it null). Feature images are not copied. Missing/trashed/not yours → `P0002`.

`search_templates(p_q) returns setof uuid` (Phase 9, `stable`, `security invoker`): live templates whose name, notes or used in, a live variation's name or used in, or a tag name contains `p_q` (case-insensitive; `\`, `%`, `_` are matched literally).

`list_tags_with_counts() returns table (id, name, color, created_at, updated_at, template_count bigint)` — `stable`, `security invoker`. The caller's tags with the number of **live** (not trashed) templates using each, sorted case-insensitively by name. Used by the sidebar and Settings → Tags. Execute granted to `authenticated` only.

`use_palette_preset(p_id uuid) returns integer` — `security invoker`. Atomically adds 1 to the caller's preset `use_count` and returns the new value (null when the preset doesn't exist or isn't theirs). Called when a preset mapping is applied in the editor. Execute granted to `authenticated` only. `valid_preset_colors(jsonb)` is the immutable helper behind the colors check.

### 5.4 Privileges & Row Level Security

- `anon` has **no** privileges on any table and can't execute `create_template`.
- RLS is enabled on every table. Each table has four policies for `authenticated` (select / insert / update / delete) with `owner_id = (select auth.uid())`.
- Exception: the `variations` delete policy also requires `not is_original`.

### 5.5 Storage

- Bucket **`feature-images`**: private, 5 MB limit, `image/png`, `image/jpeg`, `image/webp` only.
- Path: `{owner_id}/{template_id}/{template|variation_id}-{unix_ms}.webp` (timestamp busts caches; the old file is deleted after the new one is saved).
- Policies on `storage.objects` (select/insert/update/delete for `authenticated`): only inside the folder named after the user's id.
- Displayed with **signed URLs** (batch `createSignedUrls`, 1 h expiry), generated server-side.

### 5.6 Relationships (summary)

```
auth.users 1─* tags
auth.users 1─* templates 1─* variations (exactly one is_original)
                templates *─* tags         (template_tags)
                variations 1─* variations  (parent_variation_id = "based on")
auth.users 1─* palette_presets
auth.users 1─1 user_settings
storage: feature-images/{owner_id}/{template_id}/…
```

### 5.7 Schema tests (`supabase/tests/`, Vitest + PGlite) — must pass before anything is applied

1. Anonymous role can't select from any table.
2. User A can't see / insert / update rows of user B (create a second test user in the test only).
3. `template_tags` insert with a tag of another owner fails (composite FK).
4. Second Original for the same template fails.
5. Updating the Original's `content` fails (a variation's content can be updated by its owner only); renaming the Original fails; trashing the Original fails.
6. Changing `templates.type` fails.
7. Deleting a template cascades to its variations and template_tags (including the Original).
8. Purging a parent variation sets children's `parent_variation_id` to null without touching `owner_id`.
9. Duplicate variation name (case/space-insensitive) in the same template fails; same name after the first is trashed succeeds.
10. `create_template` creates exactly 1 template, 1 Original, N tag links, and rolls back completely if any insert fails (e.g. bad tag id).

The tests run the real migration files on **PGlite** (Postgres compiled to WebAssembly) with small stand-ins for Supabase's `auth` and `storage` schemas and the `anon` / `authenticated` roles (`supabase/tests/harness.ts`). They run with `npm run test`, in CI, and again in the Database Action right before `db push`. Every new migration needs matching tests.

---

## 6. The detection & swap engine (`lib/engine`)

Pure TypeScript, no I/O, 100% unit-tested. Everything else in the editor depends on it, so it gets the most care.

### 6.1 Types and API

The exact types are in `lib/engine/types.ts`; the public API is `lib/engine/index.ts`.

```ts
type ColorFormat = 'hex3' | 'hex4' | 'hex6' | 'hex8' | 'rgb' | 'rgb-modern' | 'hsl' | 'hsl-modern' | 'named' | 'other';
// rgb/hsl = legacy comma syntax (rgb() and rgba()), *-modern = rgb(0 0 0 / .5), other = hwb/lab/oklch/color() (written back as hex)
interface ColorOccurrence {
  id: string;                 // `color:${start}` (Custom) or `color:${JSON.stringify(path)}` (Elementor)
  raw: string;                // exact source text, e.g. "rgba(79,70,229,.5)"
  format: ColorFormat;
  rgb: string;                // normalized base color "#4f46e5" (grouping key)
  alpha: number;              // 0..1
  location: { kind: 'range'; start; end; line; attrQuote? } | { kind: 'path'; path: (string | number)[] };
  context: 'style-tag' | 'style-attr' | 'css-var-def' | 'svg-attr' | 'elementor-setting';
  varName?: string;           // for css-var-def: "--brand"
  snippet: string;
}
interface ColorGroup { rgb: string; count: number; occurrences: ColorOccurrence[]; formats: ColorFormat[] }
interface ImageOccurrence { id; url; kind: 'img-src' | 'srcset' | 'poster' | 'css-url' | 'link-preload' | 'elementor'; location; warning?: 'data-uri' | 'relative'; snippet }
interface FontOccurrence { id; family; raw; kind: 'font-family' | 'google-fonts-link' | 'css-import' | 'elementor-typography'; location; snippet }
interface Detection { colors: ColorGroup[]; images: ImageOccurrence[]; fonts: FontOccurrence[]; warnings: string[] }
type Swap =
  | { kind: 'color'; fromRgb: string; to: string; excludeIds?: string[] }   // to = "#rrggbb" or "#rrggbbaa"
  | { kind: 'image'; fromUrl: string; to: string; excludeIds?: string[] }
  | { kind: 'font'; fromFamily: string; to: string; excludeIds?: string[] };

detect(content: string, type: 'custom' | 'elementor'): Detection
applySwaps(content: string, type, swaps: Swap[]): { content: string; applied: { kind; from; to; count }[] }
summarize(detection): { v: 1; colors: { rgb; count }[] (top 12); colorCount; imageCount; fonts: string[] (≤ 10); warningCount }  // → variations.detected
```

- Both engines reject content over 5 MB (bytes) and throw `EngineError` with a message that is safe to show.
- Swaps are validated with `lib/validation/swaps.ts` (Zod): target colors `#rrggbb[aa]`; image links `http(s)` only, ≤ 2000 chars, no whitespace, quotes, brackets, `<>`, backslash or backtick (they could break out of an attribute, `url()` or JSON); font names letters/digits/spaces/hyphens; the same color/image/font may not be swapped twice in one call.
- Swaps that match nothing, or would write the same text, are left out of `applied`.

### 6.2 Custom (HTML + CSS + JS) rules

- Parse HTML with `parse5` (`sourceCodeLocationInfo: true`). Locate: `<style>` blocks, `style="…"` attributes, SVG color attributes (`fill`, `stroke`, `stop-color`, `flood-color`, `lighting-color`, `color`, only on elements in the SVG namespace), `<img src/srcset>`, `<source srcset>`, `<link href>` (Google Fonts stylesheets, `rel=preload as=image`), `<video poster>`. `<template>` content is scanned; `<script>`, `<textarea>`, `<noscript>` raw text and comments are not.
- Parse CSS with `postcss-safe-parser` (recovers from broken CSS like a browser, keeps exact offsets); walk declaration values with `postcss-value-parser`; convert local offsets to absolute offsets in the document. Every occurrence is checked to equal the source text at its range before it is listed.
- **Colors** are only detected in CSS values and SVG color attributes. Never in text content, and **never inside `<script>`** (too risky to change JS strings). Hex and color functions count in any declaration; **named colors** (`red`, `white`, …) count only in color properties (`color`, `background*`, `border*`, `outline*`, `box-shadow`, `fill`, `stroke`, …) and custom properties, so `animation-name: red` is not a color. `transparent`, `currentColor`, `inherit`, colors containing `var()`/`calc()` and strings are ignored.
- **Grouping:** by base RGB (`#rrggbb`, lowercase). Alpha variants of the same RGB are in the same group; when swapped they **keep their own alpha** (so a brand color's tints follow it). An opaque occurrence takes the target's alpha if the target has one. Each occurrence is written back **in its original format**: hex keeps case and short form when possible, rgb/hsl keep legacy vs modern syntax and comma spacing. Named and `other` colors are written back as hex (or `rgba()` when transparent).
- **CSS variables:** `--brand: #4f46e5` is a normal occurrence with `context: 'css-var-def'` and `varName`. Usages `var(--brand)` are not colors and are untouched; they follow the definition automatically. Fallbacks such as `var(--x, #fff)` are normal occurrences.
- **Images:** `src`, every URL in `srcset`, `url(...)` in CSS (excluding `@font-face`), `poster`, preload links. `data:` URIs and relative paths get a warning. A new link used in a `srcset` may not contain commas.
- **Fonts:** first family in each `font-family` / `font` shorthand; families from Google Fonts `<link>` / `@import` URLs (css2 `family=Inter:wght@400;700`, css v1 `family=A|B`, also `&amp;`). Swapping a font rewrites the family param in the URL (`Open+Sans`) **and** the matching `font-family` declarations (case-insensitive match). Quotes are kept as they were; new names with spaces get quotes that never clash with the surrounding attribute's quote. Generic families (`sans-serif`, …) ignored.
- **Apply:** collect all target occurrences, sort by `start` **descending**, refuse overlapping ranges, verify `content.slice(start, end) === raw` for each before replacing (if any mismatch → abort with an error, never write garbage), then replace. Callers re-run `detect` on the result to produce the new detection.

### 6.3 Elementor JSON rules

- Validate with Zod: object with `content: array` (section/page export; also accept `version`, `title`, `type`, `page_settings`). Reject other shapes with a clear message. Max 5 MB.
- Walk `page_settings` and `content[*].elements[*]…` recursively; read each element's `settings` (PHP exports empty settings as `[]`, which is skipped).
- **Colors:** string values whose key is `color`, ends with `_color`, or ends with `_color_b` (second gradient color), also inside repeater arrays, that parse as colors. `__globals__` references (e.g. `globals/colors?id=primary`) are counted into one **warning** ("N settings use site global colors or fonts …, can't swap here").
- **Images:** objects with a non-empty `url` **and** an `id` key, without `is_external` (that marks a link control): `image`, `background_image`, gallery arrays, slides, … On replace: set `url` to the new link and `id` to `""` (the old media id belongs to the original site).
- **Fonts:** keys ending with `_font_family` (generic families skipped).
- **Apply:** values are replaced **in the original JSON text** at their exact token ranges (`elementor/json-locate.ts`), not by re-serializing, so every other byte stays identical: key order (including numeric-looking keys), indentation, `\/` escapes, `\uXXXX` escapes and number formatting. New strings keep `\/` style if the old token used it and escape non-ASCII. Each token is checked to still hold the detected value; the result is re-validated. With no swaps the output equals the input byte for byte.

### 6.4 Required fixtures (minimum)

Hex 3/4/6/8, rgb/rgba legacy + modern syntax, hsl/hsla, named colors in CSS vs in text (`<p>red</p>` untouched), colors in `<script>` untouched, CSS vars, inline styles, SVG fills, gradients with several colors, `!important`, media queries, uppercase hex, the same color in 4 formats, srcset with descriptors, `url()` with and without quotes, Google Fonts link with multiple families, Elementor section and page exports with nested inner sections, repeaters, globals, galleries. Each fixture has a snapshot test for `detect` and a test for `applySwaps`.

---

## 7. Phase plan

Every phase ends with the **Phase checklist** (§8). Do not start the next phase until it passes and Hasan has seen the result.

### Phase 0 — Foundations (½–1 day)

- Create the Next.js app (TypeScript strict, App Router, ESLint, Tailwind), Prettier, absolute imports `@/`.
- Set up shadcn/ui with DESIGN.md tokens in `globals.css`; Inter + JetBrains Mono via `next/font`; light only (`color-scheme: light`, no `dark:` classes).
- Vitest + Testing Library + Playwright set up with one sample test each.
- GitHub repo, GitHub Actions CI on every push to `main` (typecheck, lint, test, build).
- Vercel project linked to `main` (every push to `main` deploys).
- `.env.example`, README with setup steps.
- **Done when:** CI is green, the Vercel site shows a blank page in Inter on white.

### Phase 1 — Database & auth (1 day)

- Create Supabase project; confirm Postgres ≥ 15.
- Write the init migration exactly as §5. The **Database** GitHub Action (`.github/workflows/db.yml`) runs the schema tests, applies migrations with `supabase db push`, regenerates `types/database.ts` from the real database and commits it if it changed. (The Claude cloud environment can't reach Supabase, so migrations are applied only by this Action.)
- Schema tests from §5.7, all green.
- Auth: **disable public sign-ups** in Supabase; create Hasan's user manually; email+password login page; `@supabase/ssr` session refresh in `proxy.ts` (read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` first); protected `(app)` layout; sign out.
- Extra guard: `proxy.ts` checks `user.email === ALLOWED_EMAIL`, else signs out.
- Create `user_settings` row on first login (upsert).
- **Done when:** logging in works, logged-out users are redirected to `/login`, all schema tests pass, generated types are committed.

### Phase 2 — App shell & tags (1 day)

- Sidebar, top bar, responsive behavior (DESIGN.md §6), toasts, empty states, command-dialog shell.
- Settings → Tags: create, rename, recolor, delete (with count confirm). Sidebar tag list with counts.
- **Done when:** shell works at 375/768/1024/1440; tag CRUD works; RLS verified by trying a request without a session.

### Phase 3 — Detection & swap engine (2–3 days, can run in parallel with Phase 2)

- Implement `lib/engine` per §6 with all fixtures.
- Coverage target: ≥ 95% lines for `lib/engine`.
- **Done when:** every fixture passes; apply → detect round-trips are consistent; no swap ever touches `<script>` or text content.

### Phase 4 — Create templates & library basics (2 days)

- New template flow (DESIGN.md §7.3): details step, Custom code (Monaco) or Elementor upload with validation, tags, notes / used in.
- Calls `create_template` RPC with `detected` summary from the engine.
- Library grid/list with cards (placeholder images for now), template overview page with variations list containing the Original.
- Copy code (Custom) and Download .json (Elementor; filename = slug of `template-variation.json`).
- **Done when:** both types can be created, show up in the library, Original is shown locked, copy/download returns byte-identical content to what was saved (test it).

**Phase 4 implementation notes**

- Content is sent to the `createTemplateAction` Server Action **gzip-compressed** (`lib/templates/upload.ts`): Vercel caps request bodies at 4.5 MB while content may be 5 MB. The server unpacks it with a 5 MB output cap (zip-bomb safe), rejects invalid UTF-8 and NUL characters, re-validates everything (Zod details, Elementor shape, size) and computes the `detected` summary itself. `serverActions.bodySizeLimit` is `4.5mb`.
- Monaco is self-hosted: `scripts/copy-monaco.mjs` (npm `postinstall`) copies `monaco-editor/min/vs` to `public/monaco/<version>/vs` (git-ignored); `proxy.ts` skips `/monaco/`. `lib/monaco.ts` holds the version; a test fails if it drifts. Auto-closing and format-on-paste are off so pasted code is saved exactly.
- `dompurify` is pinned through npm `overrides` (audit fix). Monaco's prebuilt `min` files embed their own copy, used only for Monaco's hover markdown, never for template content.
- After creating, the app opens the editor (since Phase 5). The small live preview in step 2 comes with Phase 5's `build-srcdoc`, the feature image step with Phase 6.
- The library already supports the sidebar's `?tag=` filter and `?view=list`; search, other filters and sorting are Phase 9.
- Copy code fetches content on click (a Server Action); Download is `GET /api/variations/[id]/download` with `Content-Disposition`. Both return the saved text byte for byte (tested in the route test and the schema test).

### Phase 5 — Editor, live preview & swapping (3–4 days)

- Editor layout (DESIGN.md §7.5) with resizable panes, Base selector.
- Preview: `build-srcdoc` wraps fragments in a minimal HTML document (doctype, `<meta charset>`, `<meta viewport>`), keeps full documents as-is; injects a tiny error-bridge script that `postMessage`s runtime errors. `<iframe sandbox="allow-scripts" srcdoc>` (**no `allow-same-origin`**, so template JS can't touch the app's cookies or Supabase session). Parent checks `event.source === iframe.contentWindow`.
- Device switch 1440 / 768 / 375 with scale-to-fit; 300 ms debounced live updates; refresh button.
- Palette panel: Colors / Images / Fonts tabs wired to `detect` + `applySwaps`; per-occurrence untick; jump to line in Monaco; reset per row / all.
- Typing in Monaco re-runs detection (debounced) and keeps pending swaps that still match.
- Save as variation dialog → insert into `variations` with `parent_variation_id`, `changes`, `detected`, name uniqueness error shown inline.
- Elementor editor mode: swap lists + feature image + raw JSON view (read-only Monaco), save variation the same way.
- Unsaved-changes guard.
- **Done when:** a full flow works: open Original → change 2 colors, 1 image, 1 font → save "Robo website section" → it appears in history → copy code contains the changes and nothing else changed (diff test).

**Phase 5 implementation notes**

- Editing model (`lib/editor/session.ts`, pure and unit tested): `source` is the editable code (base + manual edits). Palette changes are **pending swaps** on top of it, so every row can be reset; preview, Result tab and save all use `applySwaps(source, swaps)`. Monaco marks the occurrences a swap changes, with the new value shown inline. Unticked occurrences are cleared when the code is edited, because occurrence ids are offsets.
- Saving sends the source (gzip) and the swaps; `saveVariationAction` re-validates, applies the swaps **on the server** with the same engine, refuses a save that changes nothing, and stores `changes` and `detected`. The base variation is never modified.
- `variations.changes` shape: `[{ kind: "color" | "image" | "font", from, to, count }]` (old → new, from the engine's `applied` list), plus `{ kind: "code" }` when the code was edited by hand.
- The preview iframe keeps the pane's height (at the device width) and scrolls inside, like a browser window, so `100vh` sections look right. The bridge also reports the document height for later use.
- Elementor: read-only JSON with the swaps applied and a note instead of a live render; the feature image in the editor and in the save dialog comes with Phase 6, History with Phase 7, presets with Phase 8.
- The editor is its own route group, `app/(editor)`, protected like `(app)` but without the app shell. Pane sizes are remembered in `localStorage`. Keys: Ctrl/⌘+S saves, 1/2/3 switch the preview width.

### Phase 6 — Feature images (1–2 days)

- `POST /api/screenshot` (auth required): builds the same srcdoc, renders with `puppeteer-core` + `@sparticuz/chromium` at 1440×900, waits for network idle (max 8 s), screenshots, converts to WebP (1280×800) with `sharp`, uploads to Storage, updates the row. `maxDuration` set; request interception blocks private / link-local IPs (SSRF guard).
- Manual upload override (PNG/JPG/WebP ≤ 5 MB) with client-side preview.
- Signed URLs for cards; old images deleted after replacement.
- **Done when:** creating a Custom template produces a thumbnail automatically; upload replaces it; Elementor without upload shows the placeholder.

**Phase 6 implementation notes**

- `POST /api/screenshot` `{ templateId, variationId?, replace }` renders the Original (or that variation). After creating a template the form calls it with `replace: false`, so it only fills an empty image and never overwrites one uploaded meanwhile. The request must be same-origin JSON (CSRF guard in `lib/http.ts`).
- SSRF guard (`lib/screenshot/net-guard.ts`): Chrome never fetches anything itself. Every request is intercepted and fetched by our server through an undici agent whose DNS lookup refuses private, loopback, link-local, metadata, CGNAT and multicast addresses (IPv4 and IPv6, including mapped forms). IP literals and every redirect hop are checked too, and the connection uses the checked address, so DNS rebinding doesn't help. WebSockets/WebRTC are blocked (Chrome is pointed at a dead proxy, `ws://` URLs are blocked, and the constructors are removed). Limits: 150 requests, 10 MB per response, 40 MB total, 8 s network idle, 30 s overall. A test renders a page that tries to reach a local server and checks that it never receives a request.
- The template is served to Chrome at `http://template.invalid/` (intercepted), so new-document scripts run and relative links fail like in the live preview.
- `@sparticuz/chromium` 153 + `puppeteer-core` 25.11 (matching Chrome 153). `outputFileTracingIncludes` ships the Chromium files with `/api/screenshot`. chromium-bidi's zod is overridden to 4.6.7 (audit fix; BiDi isn't used).
- Uploads: picked in the browser (PNG/JPG/WebP ≤ 5 MB), downscaled to ≤ 1600 px so the request stays under Vercel's 4.5 MB limit, then checked by magic bytes and **re-encoded with sharp** on the server (≤ 1280 px wide, ≤ 3200 px tall from the top, WebP, metadata stripped). Stored files are always our own WebP.
- Replacing uses compare-and-swap on the row (`feature_image_path` must still be what we read); the new file is deleted if the row changed meanwhile, and the old file after a successful swap.
- Variations can have their own image (save dialog: keep template image / from this variation's preview / upload); it shows as a small thumbnail in the variations list and in the Elementor editor's preview pane. Removing it falls back to the template image.
- `createTemplateAction` now returns `{ ok, id }`; the form adds the image and opens the editor.

**Change after Phase 6 (Hasan, 2026-11-18): editable variations**

- Variations other than the Original have an **Edit** button. In the editor, **Save changes** (Ctrl/⌘+S) overwrites that variation's code; **Save as new…** still creates a new one. The Original keeps **Open** and only "Save as variation…".
- `updateVariationAction` re-checks and applies the swaps on the server like saving new, appends to `changes`, refreshes `detected`, and only writes if the row's `updated_at` is still the one the editor loaded (no silent overwrite from another tab). The old code of that variation is not kept.

### Phase 7 — History & variations management (1–2 days)

- History sheet; open any variation as base; "based on" labels; rename, used-in note, trash/restore of non-original variations; duplicate a variation as a new template.
- Compare with Monaco diff editor (current vs base, or any two variations).
- **Done when:** the Original can't be renamed or trashed from any UI path, and the DB blocks it even if the UI is bypassed (test with a direct API call).

**Phase 7 implementation notes**

- Variation row ⋯ menu (`components/templates/variation-actions.tsx`): Rename, Edit "used in", Compare with Original, Duplicate as new template, Move to trash (toast with Undo). The Original's menu has no Rename or Move to trash.
- Three layers keep the Original locked: the UI hides the items, `lib/db/variations.ts` refuses with "The Original is locked…" before writing (and filters updates on `is_original = false`), and the `protect_variation` trigger rejects it in the database. Tests: `actions/variations.test.ts` (direct calls bypassing the UI), `lib/db/variations.test.ts`, and the schema test "the Original cannot be renamed, trashed or deleted".
- Trashed variations are listed under the variations on the overview with Restore. Restoring fails with a clear message when a live variation took the name meanwhile (unique index → 23505). "Based on" still names a trashed parent ("Green (in trash)").
- "Duplicate as new template" creates a template through `create_template` whose Original is the variation's exact code, with the source template's tags and notes; Custom templates then get a screenshot (`replace: false`).
- Compare (`components/templates/compare-dialog.tsx`): read-only Monaco diff editor, any two live variations (plus "Current (unsaved)" in the editor), unchanged regions folded, one column under 768 px. Contents are fetched with `getVariationContentAction` when picked.
- Editor History sheet: every live variation newest first (Original last) with date, swatches, based-on and a change summary built from `variations.changes` (`lib/templates/changes.ts`, each changed value counted once across in-place saves). Open goes through the unsaved-changes guard.

### Phase 8 — Palette presets (1 day)

- Palettes page CRUD (name, colors with labels, reorder).
- "Save as preset" from the editor (current colors after swaps).
- "Apply preset" mapping dialog with auto-suggest (most-used detected color → first preset color …), live preview, `use_count` increment.
- **Done when:** a preset made from one template can be applied to another with a mapping and saved as a variation.

**Phase 8 implementation notes**

- Migration 5 adds the colors check and `use_palette_preset`; schema tests cover valid/invalid colors, unique names per user and that only the owner's count goes up.
- Palettes page (`components/palettes/`): cards with a 40 px strip (8 swatches, then "+N"), color count, "used N times", ⋯ Rename / Edit colors / Duplicate ("X copy", "X copy 2", …) / Delete (confirm). The create/edit dialog has name, colors with optional labels, add/remove, and reorder by drag or arrow buttons (keyboard).
- Editor palette footer: **Apply preset** and **Save as preset** next to Reset all.
  - Save as preset: the colors after pending swaps, most used first, each once (max 32), editable before saving.
  - Apply preset: a right side panel **without a backdrop**, so the live preview stays visible and updates on every change. Choosing a palette auto-suggests (most used color → first preset color …, extras "Keep"); each row can be changed. It replaces the pending color rows (`setColors`), Cancel restores them exactly, Apply keeps them as normal unsaved changes and counts one use. Saving as a variation then works as usual (the server re-applies the swaps).

### Phase 9 — Library power features (2 days)

- Search (name, notes, used in, variation names, tags) using `ilike` + trigram indexes; filters by type / tag / favorites; sort (updated, created, name); URL-driven state.
- Favorites (optimistic), duplicate template (`duplicate_template` RPC), trash/restore templates.
- Trash page; "Empty trash"; Vercel Cron daily → `/api/cron/purge-trash` (checks `CRON_SECRET`, uses service role): deletes Storage files first, then rows older than `trash_retention_days`.
- **Done when:** all filters combine correctly; trashed items disappear from library/search; purge removes both rows and files (verify in Storage).

**Phase 9 implementation notes**

- Library and Favorites share `components/library/library-browser.tsx`; Favorites is the library with the favorites filter fixed on. Filters live in the URL (`lib/library/filters.ts`: `?q=&type=&tag=&fav=1&sort=updated|created|name&view=list`); search is typed with a 300 ms pause and replaces the URL, the other filters push a history entry. Active filters show as chips with "Clear all". Text search runs in `search_templates`; type, tag and favorites filter the same query, so everything combines.
- Cards and list rows: optimistic favorite star (hover on desktop, always on touch and when on) and a ⋯ menu: Open, Duplicate ("X copy", screenshot for Custom), Edit details (name, tags, notes, used in), Add to / Remove from favorites, Move to trash (toast with Undo). The template page has the same star and menu.
- Ctrl/⌘+K searches templates with the same search (first 8) and offers "Search the library for …".
- Trash page: trashed templates and trashed variations of live templates, "deletes permanently in N days" (from `user_settings.trash_retention_days`, default 30), Restore, Delete permanently and Empty trash (both confirmed, naming the item).
- Permanent deletion (`lib/trash/purge.ts`), used by the Trash page (as the user) and the cron (service role): Storage files first (every file in `{owner}/{template}/`, and the variation's own image), then the rows, and only rows that are still trashed. If a file can't be deleted the row stays in the trash and is retried next time.
- Cron: `vercel.json` runs `GET /api/cron/purge-trash` daily at 03:00 UTC. The route checks `Authorization: Bearer $CRON_SECRET` (constant-time) and is skipped by `proxy.ts` (no session). It needs `CRON_SECRET` (16+ characters) and `SUPABASE_SERVICE_ROLE_KEY` in Vercel's environment variables (server only, never `NEXT_PUBLIC_`).

### Phase 10 — Backup export (1 day)

- `GET /api/backup` streams a `.zip`:
  ```
  template-diary-backup-2026-11-18.zip
  ├─ manifest.json            # app + schema version, exported_at, counts
  ├─ tags.json  palettes.json  settings.json
  └─ templates/{slug}/
     ├─ template.json         # metadata + tags + variation list
     ├─ variations/{nn}-{variation-slug}.html | .json
     └─ feature.webp
  ```
- Update `user_settings.last_backup_at`.
- (Later, optional) Import from this zip.
- **Done when:** export of a library with 20+ templates opens cleanly and every variation file equals the stored content.

### Phase 11 — Polish, QA & launch (2 days)

- Accessibility pass (keyboard, focus, labels, contrast), responsive pass at 375/768/1024/1440, loading/error/empty states everywhere.
- Performance: lazy-load Monaco and Puppeteer route, image sizes, React Query caching, Lighthouse ≥ 90 on Library.
- Playwright e2e for: login, create Custom, create Elementor, swap & save variation, copy/download, preset apply, trash/restore, backup.
- Production env vars, Supabase backups enabled, custom domain (optional), final review against DESIGN.md and RULES.md.

**Rough total:** ~3–4 weeks of focused work.

---

## 8. Phase checklist (run at the end of every phase)

- [ ] Everything in the phase's "Done when" works on the deployed Vercel site, not only locally.
- [ ] `tsc --noEmit`, lint, unit tests, schema tests and build all pass in CI.
- [ ] Every DB call was checked against §5 (table, column names, types, nullability, RLS). Generated types are up to date.
- [ ] New/changed schema → new migration + §5 updated + types regenerated + schema tests added.
- [ ] Screens checked at 375 / 768 / 1024 / 1440 against DESIGN.md.
- [ ] Self-review done using RULES.md §10 checklist.
- [ ] Hasan has seen it and approved before the next phase.

---

## 9. Decisions log (answered by Hasan, 2026-11-18)

1. **Tags:** a template can have **several tags** (many-to-many `template_tags`, as in §5).
2. **Code font:** **monospace (JetBrains Mono) only for code**; Inter everywhere else (DESIGN.md §3).
3. **Trash retention:** **30 days**, then permanent delete (rows + Storage files); changeable in Settings (`user_settings.trash_retention_days`).
4. **Accounts:** Hasan has GitHub, Supabase and Vercel accounts. Nothing is configured yet; setup happens in Phase 0/1.
5. **Domain:** free `*.vercel.app` address for now; custom domain can be added later without code changes.
