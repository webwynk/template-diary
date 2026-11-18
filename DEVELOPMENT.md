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

| Area                      | Choice                                                                                                               | Why                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework                 | **Next.js 16 (App Router, Turbopack, Cache Components) + TypeScript (strict)**                                       | Server Components, Server Actions, Route Handlers, first-class on Vercel |
| Styling                   | **Tailwind CSS v4 + shadcn/ui** (Radix, new-york style) + `lucide-react` icons                                       | Matches DESIGN.md tokens, accessible primitives                          |
| Font                      | `next/font/google` → Inter (UI), JetBrains Mono (code only)                                                          | Self-hosted, no layout shift                                             |
| Database / Auth / Storage | **Supabase** (Postgres 15+, Auth email+password, Storage)                                                            | One service, Row Level Security                                          |
| Supabase client           | `@supabase/ssr` + `@supabase/supabase-js`, generated TS types                                                        | Cookie-based sessions in App Router                                      |
| Code editor               | **Monaco** via `@monaco-editor/react` (+ diff editor later)                                                          | VS Code editing, HTML/JSON modes                                         |
| Preview                   | Sandboxed `<iframe srcdoc>`                                                                                          | Isolation of user JS from the app                                        |
| Parsing (engine)          | `parse5` (HTML with source locations), `postcss` + `postcss-value-parser` (CSS), `culori` (color parsing/conversion) | Accurate offsets, all color formats                                      |
| Validation                | **Zod** at every boundary (forms, server actions, route handlers, JSON imports)                                      | Runtime safety + inferred types                                          |
| Forms                     | `react-hook-form` + `@hookform/resolvers/zod`                                                                        |                                                                          |
| Data fetching (client)    | Server Components first; `@tanstack/react-query` only where client caching is needed (editor, library filters)       |                                                                          |
| Color picker              | `react-colorful`                                                                                                     | Tiny, accessible                                                         |
| Toasts                    | `sonner`                                                                                                             |                                                                          |
| Screenshots               | Route Handler with `puppeteer-core` + `@sparticuz/chromium`, `sharp` for WebP                                        | Works on Vercel serverless                                               |
| Zip (backup)              | `archiver` (server, streamed)                                                                                        | Streams large libraries                                                  |
| Tests                     | **Vitest** (unit, engine), **Playwright** (e2e), `@testing-library/react`                                            |                                                                          |
| Lint/format               | ESLint (next + typescript-eslint strict), Prettier, `tsc --noEmit`                                                   |                                                                          |
| Hosting                   | **Vercel** (app + cron), Supabase cloud (DB)                                                                         |                                                                          |
| CI                        | GitHub Actions on every push to `main`: typecheck, lint, unit tests, build, e2e                                      |                                                                          |

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
│  ├─ (app)/settings/[section]/page.tsx
│  ├─ (app)/templates/new/page.tsx
│  ├─ (app)/templates/[id]/page.tsx    # overview + variations
│  ├─ (editor)/templates/[id]/edit/page.tsx
│  ├─ api/screenshot/route.ts          # auto feature image
│  ├─ api/backup/route.ts              # zip export
│  ├─ api/cron/purge-trash/route.ts    # Vercel cron
│  └─ globals.css
├─ components/ui/                      # shadcn components (added via scripts/add-ui.mjs)
├─ components/                         # app components (library, editor, palette, …)
├─ lib/
│  ├─ engine/                          # PURE TS: detect + swap. No React, no Supabase.
│  │  ├─ types.ts
│  │  ├─ colors.ts                     # parse / normalize / format colors
│  │  ├─ custom/detect.ts              # HTML+CSS detection with offsets
│  │  ├─ custom/apply.ts               # offset-based replacement
│  │  ├─ elementor/detect.ts           # JSON walk with paths
│  │  ├─ elementor/apply.ts
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
│  └─ tests/                           # SQL tests for RLS & triggers (pgTAP)
├─ types/database.ts                   # GENERATED by `supabase gen types` — never edit by hand
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
- **Variations are append-only for content.** `content` can never be updated after insert (trigger). Name, notes and trash state can change. This is what makes history trustworthy.
- **The Original** is the variation with `is_original = true`. Exactly one per template (partial unique index). It can't be renamed, trashed or edited (trigger).
- Templates and Originals are created together in one transaction by the `create_template` RPC.
- Content is stored as `text` (not `jsonb`) for **both** types, so Copy / Download returns exactly what was saved (jsonb would reorder keys and drop formatting). Elementor JSON is validated in the app before insert.
- Soft delete with `deleted_at`. Permanent purge is done by server code so Storage files are removed too.
- `detected` (jsonb) caches the detection summary for list views (swatch strips, counts). The editor always re-runs detection from `content`, so the cache can never cause wrong swaps.

### 5.2 Migration `0001_init.sql`

```sql
-- Extensions
create extension if not exists pg_trgm;     -- fuzzy search
-- gen_random_uuid() is built in (Postgres 13+)

-- Enums
create type public.template_type as enum ('custom', 'elementor');
create type public.feature_image_source as enum ('none', 'auto', 'upload');

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-------------------------------------------------------------------------------
-- tags
-------------------------------------------------------------------------------
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  color       text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, owner_id)
);
create unique index tags_owner_name_uq on public.tags (owner_id, lower(btrim(name)));
create trigger tags_updated_at before update on public.tags
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- templates
-------------------------------------------------------------------------------
create table public.templates (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 120),
  type                  public.template_type not null,
  notes                 text check (notes is null or char_length(notes) <= 5000),
  used_in               text check (used_in is null or char_length(used_in) <= 2000),
  is_favorite           boolean not null default false,
  feature_image_path    text,                                   -- path inside bucket 'feature-images'
  feature_image_source  public.feature_image_source not null default 'none',
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, owner_id),
  check ((feature_image_path is null) = (feature_image_source = 'none'))
);
create index templates_owner_live_idx on public.templates (owner_id, updated_at desc) where deleted_at is null;
create index templates_owner_trash_idx on public.templates (owner_id, deleted_at) where deleted_at is not null;
create index templates_name_trgm_idx on public.templates using gin (name gin_trgm_ops);
create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

-- type is fixed after creation (a Custom template can never become Elementor)
create or replace function public.protect_template_type()
returns trigger language plpgsql as $$
begin
  if new.type is distinct from old.type then
    raise exception 'Template type cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger templates_protect_type before update on public.templates
  for each row execute function public.protect_template_type();

-------------------------------------------------------------------------------
-- template_tags (many-to-many)
-------------------------------------------------------------------------------
create table public.template_tags (
  template_id uuid not null,
  tag_id      uuid not null,
  owner_id    uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (template_id, tag_id),
  foreign key (template_id, owner_id) references public.templates (id, owner_id) on delete cascade,
  foreign key (tag_id, owner_id)      references public.tags (id, owner_id)      on delete cascade
);
create index template_tags_tag_idx on public.template_tags (tag_id);

-------------------------------------------------------------------------------
-- variations (Original + named saves)
-------------------------------------------------------------------------------
create table public.variations (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid(),
  template_id          uuid not null,
  parent_variation_id  uuid,                                    -- the base it was made from
  name                 text not null check (char_length(btrim(name)) between 1 and 120),
  is_original          boolean not null default false,
  content              text not null check (octet_length(content) between 1 and 5242880), -- 5 MB
  detected             jsonb not null default '{}'::jsonb,      -- cache: {colors:[{hex,count}], images:n, fonts:[...]}
  changes              jsonb not null default '[]'::jsonb,      -- swaps vs parent: [{kind,from,to,count}]
  used_in              text check (used_in is null or char_length(used_in) <= 2000),
  feature_image_path   text,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (template_id, owner_id) references public.templates (id, owner_id) on delete cascade,
  foreign key (parent_variation_id, owner_id) references public.variations (id, owner_id) on delete set null (parent_variation_id),
  check (jsonb_typeof(detected) = 'object'),
  check (jsonb_typeof(changes) = 'array'),
  check (not is_original or (parent_variation_id is null and deleted_at is null))
);
-- exactly one Original per template
create unique index variations_one_original_uq on public.variations (template_id) where is_original;
-- names unique per template among live variations (case-insensitive)
create unique index variations_name_uq on public.variations (template_id, lower(btrim(name))) where deleted_at is null;
create index variations_template_idx on public.variations (template_id, created_at desc);
create index variations_name_trgm_idx on public.variations using gin (name gin_trgm_ops);
create trigger variations_updated_at before update on public.variations
  for each row execute function public.set_updated_at();

-- content is append-only; the Original is fully locked
create or replace function public.protect_variation()
returns trigger language plpgsql as $$
begin
  if new.content is distinct from old.content then
    raise exception 'Variation content is immutable; save a new variation instead' using errcode = 'check_violation';
  end if;
  if new.template_id is distinct from old.template_id
     or new.is_original is distinct from old.is_original
     or (new.parent_variation_id is distinct from old.parent_variation_id
         and new.parent_variation_id is not null) then
    raise exception 'Variation identity fields cannot be changed' using errcode = 'check_violation';
  end if;
  if old.is_original and (new.name is distinct from old.name or new.deleted_at is not null) then
    raise exception 'The Original is locked' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger variations_protect before update on public.variations
  for each row execute function public.protect_variation();
```

> **Cross-check notes for `protect_variation`:**
>
> - `parent_variation_id` may become `null` (the `on delete set null` cascade when a parent is purged); any other change is blocked.
> - `on delete set null (parent_variation_id)` (column list) needs **Postgres 15+**. Supabase projects are 15+. Without the column list, Postgres would also null `owner_id` and fail the NOT NULL. Verify the Postgres version in Phase 1.
> - Deleting the Original row directly is blocked by the API layer (no delete on originals) and by the RLS delete policy below; it only disappears through the template cascade on purge (foreign-key cascades are not subject to RLS, which is what we want here — covered by schema test 7).
> - The `set null` cascade on a purged parent is an UPDATE on the child, so this trigger fires; it passes because only `parent_variation_id → null` changes (schema test 8).

```sql
-------------------------------------------------------------------------------
-- palette_presets
-------------------------------------------------------------------------------
create table public.palette_presets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  colors      jsonb not null default '[]'::jsonb,   -- [{ "hex": "#RRGGBB" | "#RRGGBBAA", "label": "Primary" | null }]
  use_count   integer not null default 0 check (use_count >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (jsonb_typeof(colors) = 'array' and jsonb_array_length(colors) between 1 and 32)
);
create unique index palette_presets_owner_name_uq on public.palette_presets (owner_id, lower(btrim(name)));
create trigger palette_presets_updated_at before update on public.palette_presets
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- user_settings (one row per user)
-------------------------------------------------------------------------------
create table public.user_settings (
  owner_id               uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  default_device         integer not null default 1440 check (default_device in (1440, 768, 375)),
  default_feature_mode   public.feature_image_source not null default 'auto' check (default_feature_mode <> 'none'),
  trash_retention_days   integer not null default 30 check (trash_retention_days between 1 and 365),
  last_backup_at         timestamptz,
  updated_at             timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
```

### 5.3 RPC: create template + Original atomically

```sql
create or replace function public.create_template(
  p_name text,
  p_type public.template_type,
  p_content text,
  p_tag_ids uuid[] default '{}',
  p_notes text default null,
  p_used_in text default null,
  p_detected jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker            -- runs as the caller, so RLS applies
set search_path = public
as $$
declare
  v_template_id uuid;
begin
  insert into public.templates (name, type, notes, used_in)
  values (btrim(p_name), p_type, p_notes, p_used_in)
  returning id into v_template_id;

  insert into public.variations (template_id, name, is_original, content, detected)
  values (v_template_id, 'Original', true, p_content, p_detected);

  if coalesce(array_length(p_tag_ids, 1), 0) > 0 then
    insert into public.template_tags (template_id, tag_id)
    select v_template_id, unnest(p_tag_ids);
  end if;

  return v_template_id;
end $$;
```

Duplicating a template uses a similar `duplicate_template(p_template_id uuid, p_new_name text, p_include_variations boolean)` RPC (Phase 9).

### 5.4 Row Level Security

```sql
alter table public.tags            enable row level security;
alter table public.templates       enable row level security;
alter table public.template_tags   enable row level security;
alter table public.variations      enable row level security;
alter table public.palette_presets enable row level security;
alter table public.user_settings   enable row level security;

-- Same owner policy for every table (repeat for each table name):
create policy "owner select" on public.tags for select to authenticated using (owner_id = auth.uid());
create policy "owner insert" on public.tags for insert to authenticated with check (owner_id = auth.uid());
create policy "owner update" on public.tags for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner delete" on public.tags for delete to authenticated using (owner_id = auth.uid());
-- … templates, template_tags, palette_presets, user_settings: identical.

-- variations: no direct delete of the Original
create policy "owner select" on public.variations for select to authenticated using (owner_id = auth.uid());
create policy "owner insert" on public.variations for insert to authenticated with check (owner_id = auth.uid());
create policy "owner update" on public.variations for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner delete" on public.variations for delete to authenticated using (owner_id = auth.uid() and not is_original);
```

The `anon` role gets **no** policies, so it can read nothing.

### 5.5 Storage

- Bucket **`feature-images`**, **private**, allowed MIME `image/png, image/jpeg, image/webp`, max 5 MB.
- Path: `{owner_id}/{template_id}/{template|variation_id}-{unix_ms}.webp` (timestamp busts caches; old file deleted after the new one is saved).
- Displayed with **signed URLs** (batch `createSignedUrls`, 1 h expiry), generated server-side.

```sql
create policy "own folder read"   on storage.objects for select to authenticated
  using (bucket_id = 'feature-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder write"  on storage.objects for insert to authenticated
  with check (bucket_id = 'feature-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'feature-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'feature-images' and (storage.foldername(name))[1] = auth.uid()::text);
```

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

### 5.7 Schema tests (pgTAP, `supabase/tests/`) — must pass before Phase 2

1. Anonymous role can't select from any table.
2. User A can't see / insert / update rows of user B (create a second test user in the test only).
3. `template_tags` insert with a tag of another owner fails (composite FK).
4. Second Original for the same template fails.
5. Updating `content` of any variation fails; renaming the Original fails; trashing the Original fails.
6. Changing `templates.type` fails.
7. Deleting a template cascades to its variations and template_tags (including the Original).
8. Purging a parent variation sets children's `parent_variation_id` to null without touching `owner_id`.
9. Duplicate variation name (case/space-insensitive) in the same template fails; same name after the first is trashed succeeds.
10. `create_template` creates exactly 1 template, 1 Original, N tag links, and rolls back completely if any insert fails (e.g. bad tag id).

---

## 6. The detection & swap engine (`lib/engine`)

Pure TypeScript, no I/O, 100% unit-tested. Everything else in the editor depends on it, so it gets the most care.

### 6.1 Types

```ts
type ColorFormat = 'hex3' | 'hex4' | 'hex6' | 'hex8' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'named' | 'modern'; // modern = rgb(0 0 0 / .5)
interface ColorOccurrence {
  id: string;                 // stable: `${start}:${raw}` (Custom) or JSON path (Elementor)
  raw: string;                // exact source text, e.g. "rgba(79,70,229,.5)"
  format: ColorFormat;
  rgb: string;                // normalized base color "#4f46e5" (grouping key)
  alpha: number;              // 0..1
  location: { start: number; end: number; line: number } | { path: (string | number)[] };
  context: 'style-tag' | 'style-attr' | 'css-var-def' | 'svg-attr' | 'elementor-setting';
  varName?: string;           // for css-var-def: "--brand"
  snippet: string;
}
interface ColorGroup { rgb: string; count: number; occurrences: ColorOccurrence[]; formats: ColorFormat[] }
interface ImageOccurrence { id; url; kind: 'img-src' | 'srcset' | 'css-url' | 'link-preload' | 'elementor'; location; warning?: 'data-uri' | 'relative' }
interface FontOccurrence { id; family; kind: 'font-family' | 'google-fonts-link' | 'css-import' | 'elementor-typography'; location }
interface Detection { colors: ColorGroup[]; images: ImageOccurrence[]; fonts: FontOccurrence[]; warnings: string[] }
type Swap =
  | { kind: 'color'; fromRgb: string; to: string; excludeIds: string[] }
  | { kind: 'image'; fromUrl: string; to: string; excludeIds: string[] }
  | { kind: 'font'; fromFamily: string; to: string; excludeIds: string[] };

detect(content: string, type: 'custom' | 'elementor'): Detection
applySwaps(content: string, type, swaps: Swap[]): { content: string; applied: AppliedChange[] }
```

### 6.2 Custom (HTML + CSS + JS) rules

- Parse HTML with `parse5` (`sourceCodeLocationInfo: true`). Locate: `<style>` blocks, `style="…"` attributes, SVG `fill` / `stroke` / `stop-color` attributes, `<img src/srcset>`, `<source srcset>`, `<link href>` (Google Fonts, preload images), `<video poster>`.
- Parse CSS inside those with `postcss`; walk declaration values with `postcss-value-parser`; convert local offsets to absolute offsets in the document.
- **Colors** are only detected in CSS values and SVG color attributes. Never in text content, and **never inside `<script>`** (too risky to change JS strings). Named colors (`red`, `white`, …) only count inside CSS values; `transparent`, `currentColor`, `inherit` are ignored.
- **Grouping:** by base RGB (`#rrggbb`, lowercase). Alpha variants of the same RGB are in the same group; when swapped they **keep their own alpha** (so a brand color's tints follow it). Each occurrence is written back **in its original format** (hex stays hex, rgba stays rgba). Named colors are written back as hex.
- **CSS variables:** `--brand: #4f46e5` is a normal occurrence with `context: 'css-var-def'` and `varName`. Usages `var(--brand)` are not colors and are untouched; they follow the definition automatically.
- **Images:** `src`, every URL in `srcset`, `url(...)` in CSS (excluding fonts: `@font-face src`), `poster`. `data:` URIs and relative paths get a warning.
- **Fonts:** first family in each `font-family` / `font` shorthand; families from Google Fonts `<link>` / `@import` URLs (`family=Inter:wght@400;700`). Swapping a Google font rewrites the family param in the URL **and** the matching `font-family` declarations. Generic families (`sans-serif`, …) ignored.
- **Apply:** collect all target occurrences, sort by `start` **descending**, verify `content.slice(start, end) === raw` for each before replacing (if any mismatch → abort with an error, never write garbage), then replace. Re-run `detect` on the result to produce the new detection.

### 6.3 Elementor JSON rules

- Validate with Zod: object with `content: array` (section/page export; also accept `version`, `title`, `type`). Reject other shapes with a clear message. Max 5 MB.
- Walk `content[*].elements[*]…` recursively; read each element's `settings`.
- **Colors:** string values whose key ends with `_color` or equals `color` (also inside repeater arrays) that parse as colors. `__globals__` references (e.g. `globals/colors?id=primary`) are listed as **warnings** ("uses a site global color, can't swap here").
- **Images:** objects with a `url` key under settings (`image`, `background_image`, gallery arrays, …). On replace: set `url` to the new link and `id` to `""` (the old media id belongs to the original site).
- **Fonts:** keys ending with `_font_family`.
- **Apply:** by JSON path on the parsed object, then `JSON.stringify(obj)` (compact, as Elementor exports). Test round-trip: parse → stringify with no swaps must equal `JSON.stringify(JSON.parse(original))`.
- Note: JS reorders integer-like object keys. Elementor uses string keys, but add a fixture test to confirm nothing reorders.

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
- Write `0001_init.sql` exactly as §5; `supabase db push`; `supabase gen types typescript > types/database.ts`.
- pgTAP tests from §5.7, all green.
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

### Phase 6 — Feature images (1–2 days)

- `POST /api/screenshot` (auth required): builds the same srcdoc, renders with `puppeteer-core` + `@sparticuz/chromium` at 1440×900, waits for network idle (max 8 s), screenshots, converts to WebP (1280×800) with `sharp`, uploads to Storage, updates the row. `maxDuration` set; request interception blocks private / link-local IPs (SSRF guard).
- Manual upload override (PNG/JPG/WebP ≤ 5 MB) with client-side preview.
- Signed URLs for cards; old images deleted after replacement.
- **Done when:** creating a Custom template produces a thumbnail automatically; upload replaces it; Elementor without upload shows the placeholder.

### Phase 7 — History & variations management (1–2 days)

- History sheet; open any variation as base; "based on" labels; rename, used-in note, trash/restore of non-original variations; duplicate a variation as a new template.
- Compare with Monaco diff editor (current vs base, or any two variations).
- **Done when:** the Original can't be renamed or trashed from any UI path, and the DB blocks it even if the UI is bypassed (test with a direct API call).

### Phase 8 — Palette presets (1 day)

- Palettes page CRUD (name, colors with labels, reorder).
- "Save as preset" from the editor (current colors after swaps).
- "Apply preset" mapping dialog with auto-suggest (most-used detected color → first preset color …), live preview, `use_count` increment.
- **Done when:** a preset made from one template can be applied to another with a mapping and saved as a variation.

### Phase 9 — Library power features (2 days)

- Search (name, notes, used in, variation names, tags) using `ilike` + trigram indexes; filters by type / tag / favorites; sort (updated, created, name); URL-driven state.
- Favorites (optimistic), duplicate template (`duplicate_template` RPC), trash/restore templates.
- Trash page; "Empty trash"; Vercel Cron daily → `/api/cron/purge-trash` (checks `CRON_SECRET`, uses service role): deletes Storage files first, then rows older than `trash_retention_days`.
- **Done when:** all filters combine correctly; trashed items disappear from library/search; purge removes both rows and files (verify in Storage).

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
