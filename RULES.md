# Template Diary — Engineering Rules (RULES.md)

> These rules are **mandatory** for every line of code, every migration and every review,
> whether written by a human or by Claude. Read this file before starting any task.
> If a rule blocks you, stop and ask; do not quietly break it.
>
> Related: `DESIGN.md` (UI source of truth), `DEVELOPMENT.md` (plan + database contract in §5).

---

## 1. Mindset: think like a senior engineer

1. **Understand before you type.** Restate the task in one or two sentences, list the files and tables it touches, and identify edge cases _before_ writing code.
2. **Correctness over speed.** Shipping a bug into someone's template library (wrong color swapped, lost variation) is worse than shipping a day later.
3. **Simple and boring wins.** Prefer the clear solution over the clever one. No abstraction until the second real use.
4. **Own the whole change.** Code, types, tests, migration, docs, and the UI states (loading, empty, error) are all part of "done".
5. **Never guess.** If a column name, API behavior, or library option is uncertain, look it up (schema doc, generated types, official docs) or ask. Write down assumptions explicitly.
6. **Leave it better.** Fix small nearby problems you notice, or note them; never make the area worse.

---

## 2. Always double-check, always cross-check

Every change goes through **two passes**: write it, then review it as if someone else wrote it.

**Double-check (your own change)**

- Re-read the full diff line by line before calling anything done.
- Run it: typecheck, lint, tests, and the actual feature in the browser.
- Try the unhappy paths: empty input, huge input, invalid file, no network, double click, back button, expired session.

**Cross-check (against the rest of the system)**

- **Against the database:** every table/column/enum/function you use exists in `DEVELOPMENT.md §5` **and** in `types/database.ts` with the same name, type and nullability. Check RLS will allow the query for the logged-in user and block it otherwise.
- **Against DESIGN.md:** tokens, spacing, typography (Inter), components, states, and the four breakpoints (375 / 768 / 1024 / 1440).
- **Against DEVELOPMENT.md:** the change belongs to the current phase and meets its "Done when".
- **Against existing code:** search for an existing helper/component before writing a new one; make sure callers of anything you changed still work.
- **Against the engine contract:** any code that changes template content goes through `lib/engine` and is covered by tests.

---

## 3. Database rules

1. **Migrations are the only way to change the schema.** New timestamped file in `supabase/migrations/`. Never edit the schema in the Supabase dashboard. Never edit a migration that has already been applied; write a new one.
2. **Schema change = 4 things in one commit:** migration file, update `DEVELOPMENT.md §5`, add/adjust schema tests in `supabase/tests/`. After pushing, the Database Action applies the migration and commits regenerated `types/database.ts`; `git pull` before the next change.
3. **Generated types are never hand-edited**, with one exception: in the commit that adds a migration you may add the matching entries to `types/database.ts` (in the generated format) so the code typechecks. The Database Action then overwrites the file with real `supabase gen types` output; check its diff. If the generated types look wrong, the migration is wrong.
4. **RLS is always on** for every table in `public`. Every new table gets owner policies in the same migration. No policy for `anon`.
5. **Ownership is enforced by the database**, not only by the app: `owner_id` default `auth.uid()`, composite foreign keys `(parent_id, owner_id)` for child tables.
6. **Invariants live in the database** (constraints, unique indexes, triggers): one Original per template, variation content immutable, Original locked, template type fixed. The app checks them too for nice errors, but the DB is the final guard.
7. **Multi-step writes are atomic.** Use a Postgres function (RPC) or a single statement. Never create a template in one request and its Original in another.
8. **All DB access goes through `lib/db/`** typed functions. No ad-hoc `supabase.from(...)` scattered in components.
9. **Always handle `{ error }`** from Supabase. Never ignore it, never assume `data` is non-null.
10. **Select only the columns you need** (do not `select('*')` in list views, especially not `content`).
11. **Service role key only in server code** that truly needs to bypass RLS (cron purge). Never in a component, never in a `NEXT_PUBLIC_` variable, never logged.
12. **Before any destructive SQL** (drop, delete without where, data migration): write down the rollback, test on a copy/branch first, and ask Hasan.

---

## 4. TypeScript & code style

- `strict: true`, `noUncheckedIndexedAccess: true`. No `any` (use `unknown` + narrowing). No `@ts-ignore`; `@ts-expect-error` only with a comment why.
- No non-null assertions (`!`) on data from the network or DB.
- Zod schemas in `lib/validation/` are the source of truth for input shapes; infer types from them (`z.infer`).
- Naming: components `PascalCase.tsx`, hooks `useThing.ts`, utilities `camelCase.ts`, DB columns `snake_case`, TS properties map explicitly (no silent casing magic).
- Functions do one thing; files stay under ~300 lines; split when they grow.
- No commented-out code, no `console.log` left behind (use a small `logger` that is silent in production for non-errors).
- Prettier formatting, ESLint clean, imports sorted. No unused exports.
- Comments explain **why**, not what.

---

## 5. Next.js / React rules

- This project uses **Next.js 16**, which differs from older Next.js. Before using any Next.js API or file convention, read its guide in `node_modules/next/dist/docs/` (see `AGENTS.md`). Never code Next.js from memory.
- Server Components by default. `'use client'` only for interactivity (editor, palette, dialogs).
- Mutations via **Server Actions** or Route Handlers that: (1) get the user from the session, (2) validate input with Zod, (3) call `lib/db`, (4) return a typed result `{ ok: true, data } | { ok: false, error }`, (5) revalidate affected paths.
- Never trust the client: server code re-validates everything, including ids and enum values.
- Heavy client libraries (Monaco, diff editor, color picker) are dynamically imported.
- Every async UI has loading, empty and error states (DESIGN.md §9).
- Keys in lists are stable ids, never array indexes for editable lists.
- Avoid `useEffect` for derived state; compute it. Debounce expensive work (detection 300 ms, preview 300 ms).

---

## 6. Template content & engine rules (critical)

1. **Never change user content silently.** Every change comes from an explicit user swap and is listed as old → new.
2. **Content round-trips exactly.** What is saved is what Copy Code / Download returns, byte for byte. Test it.
3. **All content changes go through `lib/engine.applySwaps`.** No regex replace of colors in components.
4. **Offset safety:** before replacing, verify the source text at the offset equals the expected `raw`; if not, abort with an error. Apply replacements from the end of the document to the start.
5. **Never touch** `<script>` contents, text content, HTML comments, or attribute values that aren't known color/image/font places.
6. **Variations are append-only.** "Save" always inserts a new variation. The Original is never modified.
7. **Every engine change needs fixtures + tests**, including a regression test for any bug found.

---

## 7. Security rules

- **Preview iframe:** `sandbox="allow-scripts"` and `srcdoc` only. **Never** add `allow-same-origin` (it would let template JS read the app session). Validate `postMessage` by `event.source`, and treat message data as untrusted.
- Never render template HTML in the app DOM (no `dangerouslySetInnerHTML` of user templates outside the sandbox).
- Auth: public sign-up disabled; `proxy.ts` enforces the session **and** `ALLOWED_EMAIL`. Every Server Action / Route Handler checks the user itself (don't rely only on the proxy).
- Screenshot route: auth required, size limits, timeout, blocks private/link-local IP requests.
- Uploads: check MIME type **and** size on the server; only image types to the `feature-images` bucket under the user's folder.
- Pasted URLs: only `http:` / `https:` accepted for image replacements.
- Secrets live in env vars; `.env*` files never committed; never log tokens, keys or full template content.
- Keep dependencies updated; review `npm audit` high/critical issues before each release.

---

## 8. Testing rules

- **Engine (`lib/engine`)**: ≥ 95% line coverage, fixture-based, snapshot + behavior tests.
- **Database**: schema tests for RLS, constraints and triggers (`DEVELOPMENT.md §5.7`), run on PGlite in CI and before every migration is applied.
- **Validation schemas**: unit tests for valid and invalid input.
- **E2E (Playwright)**: the main flows listed in Phase 11 must pass before production deploy.
- A bug fix starts with a failing test that reproduces it.
- When a test fails, re-run only the failing tests while fixing; run the full suite before merging.
- Never skip, delete or weaken a test to make CI green.

---

## 9. Git & workflow rules

- Repository: `github.com/webwynk/template-diary`. **Always work on `main`** (Hasan's decision, 2026-11-18): no feature branches, no PRs, commit and push straight to `main`.
- Because there is no PR gate, **every push must already be green locally**: `npm run check` (typecheck, lint, format, unit tests, build) passes, plus `npm run test:e2e` when UI changed, and the self-review checklist (§10) is done before `git push`. Never push a broken `main`.
- Small, focused commits with clear messages: `feat(editor): add device switcher`, `fix(engine): keep alpha on rgba swap`. One logical change per commit so any commit can be reverted on its own.
- Never rewrite `main` history (no force-push, no rebase of pushed commits). Undo with `git revert`.
- Never commit secrets, `.env.local`, generated build output or large binaries.
- Update the docs (`DESIGN.md`, `DEVELOPMENT.md`, `RULES.md`) in the same commit when a decision changes. The docs must never disagree with the code.
- Vercel deploys `main` to production automatically, which is another reason a push to `main` must be fully checked first.

---

## 10. Self-review checklist (run before every push to `main`)

**Understanding**

- [ ] I can explain what this change does and why in two sentences.
- [ ] It belongs to the current phase in `DEVELOPMENT.md`.

**Database**

- [ ] Every table/column/function used matches `DEVELOPMENT.md §5` and `types/database.ts`.
- [ ] RLS allows the intended access and blocks others; I tested without a session.
- [ ] Schema changed? → migration + §5 + schema tests in this commit; regenerated types pulled after the Database Action ran.
- [ ] Multi-step writes are atomic; every `{ error }` is handled.

**Code**

- [ ] Typecheck, lint, tests and build pass locally and in CI.
- [ ] No `any`, no `!` on external data, no leftover logs or commented code.
- [ ] Inputs validated with Zod on the server.
- [ ] Content changes go through `lib/engine`; round-trip tests still pass.

**UI**

- [ ] Matches `DESIGN.md` tokens, Inter font, light only.
- [ ] Checked at 375 / 768 / 1024 / 1440.
- [ ] Loading, empty, error states present; keyboard and focus work.

**Safety**

- [ ] No secrets exposed; service role key not reachable from the client.
- [ ] Preview iframe still has no `allow-same-origin`.
- [ ] Destructive actions are confirmed or reversible.

**Final pass**

- [ ] I re-read the whole diff once more, as a reviewer, looking for mistakes.

---

## 11. When unsure

Stop and ask Hasan when:

- A requirement can be read two ways and the choice changes behavior the user will notice.
- A step can't be undone (production data, deleting files, schema drops).
- A rule in this file seems to block the right solution (we then update the rule, deliberately).

Otherwise pick the most reasonable option, write the assumption in the commit message, and continue.
