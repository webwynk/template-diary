# Template Diary — Design System (DESIGN.md)

> This file is the single source of truth for how Template Diary looks and feels.
> Every screen, component and state must follow it. If something is not covered here,
> decide it, then **add it to this file** before or in the same change that ships it.
>
> Related docs: `DEVELOPMENT.md` (what we build and when), `RULES.md` (how we build it).

---

## 1. Design principles

1. **White, calm, modern.** Pure white canvas, soft grey surfaces, one confident accent color. No dark mode, ever. No gradients on UI chrome, no heavy shadows.
2. **Content first.** The user's templates (feature images, code, previews) are the colorful part of the app. The UI stays neutral so it never fights with the template colors.
3. **One font: Inter.** Every piece of UI text uses Inter. The only exception is code, which uses a monospace font (see §3).
4. **Fast to scan.** Clear hierarchy, generous spacing, predictable placement. A WordPress developer should find a template in under 5 seconds.
5. **Responsive by default.** Every screen works at 375px, 768px, 1024px and 1440px+. No horizontal page scroll at any width.
6. **Safe by default.** Destructive actions are reversible (trash) or confirmed. The original of a template is visibly locked.
7. **Consistent.** Build with shadcn/ui primitives and the tokens below. Do not invent one-off colors, sizes or shadows.

---

## 2. Color tokens (light only)

Defined as hex CSS variables in `app/globals.css` (`:root`) and exposed to Tailwind v4 through `@theme inline` in the same file (there is no `tailwind.config.ts`). Use them as utilities, e.g. `bg-surface`, `text-muted-foreground`, `border-border-strong`, `bg-primary-soft`.

| Token                  | Hex             | Tailwind ref | Use                                                    |
| ---------------------- | --------------- | ------------ | ------------------------------------------------------ |
| `--background`         | `#FFFFFF`       | white        | Page background, cards                                 |
| `--surface`            | `#F8FAFC`       | slate-50     | Sidebar, panels, table header, code-panel frame        |
| `--surface-2`          | `#F1F5F9`       | slate-100    | Hover rows, segmented control background, skeletons    |
| `--border`             | `#E2E8F0`       | slate-200    | All borders and dividers                               |
| `--border-strong`      | `#CBD5E1`       | slate-300    | Input borders on hover, focused dividers               |
| `--foreground`         | `#0F172A`       | slate-900    | Primary text, headings                                 |
| `--muted-foreground`   | `#64748B`       | slate-500    | Secondary text, labels, placeholders                   |
| `--subtle-foreground`  | `#94A3B8`       | slate-400    | Disabled text, meta info                               |
| `--primary`            | `#4F46E5`       | indigo-600   | Primary buttons, active nav, links, focus ring         |
| `--primary-hover`      | `#4338CA`       | indigo-700   | Primary hover                                          |
| `--primary-soft`       | `#EEF2FF`       | indigo-50    | Selected items, active tab bg, badges                  |
| `--primary-foreground` | `#FFFFFF`       | white        | Text on primary                                        |
| `--success`            | `#16A34A`       | green-600    | Saved, copied, success toasts                          |
| `--success-soft`       | `#F0FDF4`       | green-50     | Success badge background                               |
| `--warning`            | `#D97706`       | amber-600    | Warnings (e.g. data-URI image, Elementor global color) |
| `--warning-soft`       | `#FFFBEB`       | amber-50     | Warning badge background                               |
| `--destructive`        | `#DC2626`       | red-600      | Delete permanently, errors                             |
| `--destructive-soft`   | `#FEF2F2`       | red-50       | Error background                                       |
| `--ring`               | `#4F46E5` @ 40% | —            | Focus ring                                             |

**Type badges** (template type):

| Type      | Text                 | Background          |
| --------- | -------------------- | ------------------- |
| Custom    | `#0369A1` (sky-700)  | `#F0F9FF` (sky-50)  |
| Elementor | `#BE185D` (pink-700) | `#FDF2F8` (pink-50) |

**Rules**

- Text contrast must be at least WCAG AA (4.5:1 for body, 3:1 for large text). The pairs above all pass on white.
- Never use pure black `#000`. Never use the accent for large backgrounds.
- No `dark:` classes anywhere. `<html>` has `class="light"` and `color-scheme: light`.
- Color swatches that show **template** colors always sit on a checkerboard background (so transparent colors are visible) with a `1px` `--border` outline (so white swatches are visible on white).

---

## 3. Typography — Inter everywhere

- Load with `next/font/google`: `Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })`.
- `body { font-family: var(--font-inter), system-ui, sans-serif; }` and Tailwind `fontFamily.sans = ['var(--font-inter)', ...]`.
- Turn on Inter features globally: `font-feature-settings: "cv11", "ss01";` and `font-variant-numeric: tabular-nums` on numbers in tables/counters.
- **Code only: JetBrains Mono (the single exception, decided by Hasan 2026-11-18).** Used in the Monaco editor, the diff editor, inline code and hex/rgb values. Load with `next/font/google`: `JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono' })`, Tailwind `fontFamily.mono = ['var(--font-mono)', 'ui-monospace', 'monospace']`, Monaco `fontFamily: 'var(--font-mono), ui-monospace, monospace'`, `fontLigatures: false`. Everything that is not code stays Inter.
- **The preview iframe is NOT the app.** It renders the template with the template's own fonts. Inter must never leak into the preview.

**Type scale** (size / line-height / weight):

| Token         | Size | Line height | Weight | Use                                                                                  |
| ------------- | ---- | ----------- | ------ | ------------------------------------------------------------------------------------ |
| `display`     | 30px | 36px        | 700    | Login screen title only                                                              |
| `h1`          | 24px | 32px        | 600    | Page titles ("Library", "Settings")                                                  |
| `h2`          | 20px | 28px        | 600    | Section titles, dialog titles                                                        |
| `h3`          | 16px | 24px        | 600    | Card titles, panel headings                                                          |
| `body`        | 14px | 20px        | 400    | Default UI text                                                                      |
| `body-strong` | 14px | 20px        | 500    | Buttons, labels, nav items                                                           |
| `small`       | 13px | 18px        | 400    | Meta info, helper text                                                               |
| `caption`     | 12px | 16px        | 500    | Badges, counters, table headers (uppercase + 0.04em tracking only for table headers) |
| `code`        | 13px | 20px        | 400    | Monaco, inline code, hex values (JetBrains Mono)                                     |

Letter spacing: `-0.01em` on h1/h2/display. Default elsewhere.

---

## 4. Spacing, radius, shadow, motion

- **Spacing:** 4px grid. Use Tailwind steps 1, 2, 3, 4, 5, 6, 8, 10, 12, 16. Page padding: 16px (mobile), 24px (tablet), 32px (desktop).
- **Max content width:** library and settings pages `max-w-[1400px]` centered. The editor is full width.
- **Radius:** `--radius: 10px`. Buttons/inputs `8px`, cards/dialogs `12px`, badges/pills `9999px`, swatches `6px`.
- **Shadows (only three):**
  - `shadow-xs`: `0 1px 2px rgb(15 23 42 / 0.05)` — inputs, buttons (secondary)
  - `shadow-sm`: `0 1px 3px rgb(15 23 42 / 0.08), 0 1px 2px rgb(15 23 42 / 0.04)` — cards on hover, dropdowns
  - `shadow-lg`: `0 10px 30px rgb(15 23 42 / 0.12)` — dialogs, sheets, command palette
- **Motion:** 150ms `ease-out` for hover/focus, 200ms for panels/sheets. Respect `prefers-reduced-motion` (disable transforms, keep opacity).
- **Icons:** `lucide-react`, 16px in buttons/inputs, 20px in nav, stroke width 1.75. Icon-only buttons always have `aria-label` and a tooltip.

---

## 5. Breakpoints & responsive behavior

| Name  | Min width | Layout                                                       |
| ----- | --------- | ------------------------------------------------------------ |
| base  | 0         | Single column, bottom-sheet panels, top bar with menu button |
| `sm`  | 640px     | 2-column template grid                                       |
| `md`  | 768px     | Collapsible sidebar (icon rail), 2–3 column grid             |
| `lg`  | 1024px    | Full sidebar (240px), editor split view appears              |
| `xl`  | 1280px    | 4-column grid, editor shows all three panes                  |
| `2xl` | 1536px    | 5-column grid                                                |

Touch targets are at least 40×40px below `lg`. Hover-only actions must also be reachable by a visible "⋯" menu on touch screens.

---

## 6. App shell

```
┌──────────────────────────────────────────────────────────────────────┐
│ Sidebar (240px, --surface)  │ Top bar (56px, white, border-bottom)    │
│ ┌─────────────────────────┐ │ [Page title]      [⌘K Search] [+ New]   │
│ │ ◆ Template Diary        │ ├─────────────────────────────────────────┤
│ │                         │ │                                         │
│ │ ▣ Library               │ │              Page content               │
│ │ ★ Favorites             │ │                                         │
│ │ ◐ Palettes              │ │                                         │
│ │ 🗑 Trash          (3)    │ │                                         │
│ │ ─────────────           │ │                                         │
│ │ TAGS                    │ │                                         │
│ │ • Hero          12      │ │                                         │
│ │ • Pricing        4      │ │                                         │
│ │ ─────────────           │ │                                         │
│ │ ⚙ Settings              │ │                                         │
│ │ ⤓ Backup                │ │                                         │
│ │ (avatar) Hasan  ⎋       │ │                                         │
│ └─────────────────────────┘ │                                         │
└──────────────────────────────────────────────────────────────────────┘
```

- Active nav item: `--primary-soft` background, `--primary` text and icon, 8px radius.
- Below `lg`: sidebar becomes a 64px icon rail (`md`) or a left sheet opened from a menu button (base).
- Global search (`⌘K` / `Ctrl+K`) opens a command dialog (shadcn `Command`) that searches template names, variation names, tags and "used in" notes.
- The editor route hides the sidebar to give maximum room (back arrow in its own top bar).

---

## 7. Screens

### 7.1 Login

- Centered card (max 400px) on white, logo + "Template Diary" in `display`, subtitle in muted.
- Email + password fields, "Sign in" primary full-width button. No sign-up link (single user).
- Errors shown inline under the form in `--destructive` with an icon. Never reveal whether the email exists.

### 7.2 Library (dashboard) — `/`

```
Library                                    [⌘K Search]  [+ New template]
┌────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search templates…        ] [Type ▾] [Tag ▾] [★ Favorites] [Sort ▾] │
│                                                      [▦ Grid] [≡ List] │
└────────────────────────────────────────────────────────────────────────┘
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ [image    │ │ [image    │ │ [image    │ │ [image    │
│  16:10]   │ │  16:10]   │ │  16:10]   │ │  16:10]   │
│ Hero dark │ │ Pricing 3 │ │ Footer v2 │ │ Robo page │
│ Custom·Hero│ │Elementor  │ │ ...       │ │ ...       │
│ 4 var · 2d│ │ ...    ★  │ │           │ │           │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
```

**Template card**

- White, `1px --border`, 12px radius, no shadow at rest; `shadow-sm` + border `--border-strong` on hover.
- Feature image: 16:10, `object-fit: cover`, `object-position: top`, top radius 12px, `--surface-2` background while loading (skeleton shimmer). Missing image → neutral placeholder with the type icon and template initials.
- Body (12px padding): name (`h3`, 1 line, ellipsis), then a row with type badge + tag pills (max 2, then "+N"), then meta (`small`, muted): "4 variations · edited 2d ago".
- Top-right overlay on the image: favorite star button (filled amber `#F59E0B` when on). Visible on hover on desktop, always visible on touch and when favorited.
- "⋯" menu: Open, Duplicate, Edit details, Add to favorites, Move to trash.
- Whole card is a link to the template page; buttons inside stop propagation.

**List view**: table with columns Image (64×40 thumb), Name, Type, Tags, Variations, Updated, actions. Sticky header on `--surface`.

**Filters**: URL-driven (`?q=&type=&tag=&fav=1&sort=`) so filtered views can be bookmarked and the back button works. Active filters show as removable chips with "Clear all".

**Empty states**

- No templates yet: illustration-free card with icon, "Your library is empty", short line, primary "Create your first template" button.
- No results: "No templates match these filters" + "Clear filters" button.

### 7.3 New template — `/templates/new` (also used as a dialog from "+ New")

Two-step layout in a centered column (max 760px):

**Step 1 — Details**

- Name (required, max 120 chars).
- Type: two large selectable cards side by side (stacked on mobile): **Custom code** ("HTML + CSS + JS in one box") and **Elementor** ("Upload a section or page .json export"). Selected card: `--primary` 2px border + `--primary-soft` background + check icon.
- Tags: multi-select combobox with existing tags (colored dot + name). "Manage tags" link to settings.
- Notes / "Used in" (optional textarea).

**Step 2 — Content**

- Custom: Monaco editor (min-height 420px) with a small live preview below on mobile / to the right on `lg`.
- Elementor: drag-and-drop zone (dashed `--border-strong`, 12px radius, 180px tall, `--surface` bg; on drag-over: `--primary` dashed border + `--primary-soft`). Shows file name, size, detected Elementor type (section / page) and number of widgets after parsing. Invalid file → inline error explaining why (not JSON, missing `content`, too big).
- Feature image: "Auto-generate from desktop preview" (default, Custom only) or "Upload image" (PNG/JPG/WebP, max 5 MB). Elementor defaults to upload; if skipped, the placeholder is used.
- Footer: [Back] [Create template]. Creating saves the **Original** (locked) and redirects to the editor.

### 7.4 Template overview — `/templates/[id]`

```
← Library
[Feature image 16:10, max 480px]   Hero dark                         [★] [⋯]
                                   Custom · Hero · Landing
                                   Used in: client-x.com, robo-agency
                                   [Open editor]  [Copy original code]
──────────────────────────────────────────────────────────────────────────
Variations (5)                                         [Search variations]
┌──────────────────────────────────────────────────────────────────────┐
│ 🔒 Original                         created 12 Oct  [Copy] [Open]  ⋯ │
│ Robo website section                updated 2d ago  [Copy] [Open]  ⋯ │
│ Green agency version                updated 5d ago  [Copy] [Open]  ⋯ │
└──────────────────────────────────────────────────────────────────────┘
```

- Each row shows a small swatch strip (top 6 colors of that variation), name, "based on: X" in muted text, date, and actions: **Copy code** (Custom) / **Download .json** (Elementor), **Open in editor**, ⋯ (Rename, Use as base, Edit "used in", Duplicate as new template, Move to trash).
- The Original row has a lock icon, a subtle `--surface` background and no Rename/Trash actions.

### 7.5 Editor — `/templates/[id]/edit?base=<variationId>` (the most important screen)

**Desktop (≥ 1280px): three panes**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Hero dark   Base: 🔒 Original ▾   ● Unsaved changes   [History] [Save as…] │ 56px
├───────────────────────┬──────────────────────────────────────┬───────────────┤
│ CODE        [Format]  │ PREVIEW   [🖥 1440][▭ 768][📱 375] ⟳ │ PALETTE       │
│                       │ ┌──────────────────────────────────┐ │ [Colors][Img] │
│  Monaco editor        │ │                                  │ │ [Fonts]       │
│  (combined HTML/CSS/  │ │   sandboxed iframe, scaled to    │ │               │
│   JS)                 │ │   fit, real device width         │ │ ■ #1E293B  14 │
│                       │ │                                  │ │ ■ #4F46E5   9 │
│                       │ │                                  │ │ ■ #FFFFFF   7 │
│                       │ └──────────────────────────────────┘ │ ...           │
│                       │  1440 × auto · 62%                   │ [Apply preset]│
│ resizable ↔           │                                      │ [Save preset] │
└───────────────────────┴──────────────────────────────────────┴───────────────┘
        ~35%                          flexible                      320px
```

- Panes are resizable (drag handles, 4px wide, `--border`, `--primary` on hover/drag). Code pane can be collapsed to give the preview more room. Sizes are remembered in `localStorage`.
- **Top bar:** back link with template name, a **Base** dropdown (which variation you started from; Original shows a lock), unsaved-changes indicator (amber dot + text), History button (opens right sheet), **Save as variation…** primary button (opens naming dialog). `Ctrl/⌘+S` opens the same dialog.
- Leaving with unsaved changes → confirm dialog ("Discard changes?").

**Preview pane**

- Segmented device control: Desktop **1440**, Tablet **768**, Mobile **375** (icons + numbers). Active segment: white bg, `shadow-xs`, `--foreground` text, on a `--surface-2` track.
- The iframe is rendered at the real device width and scaled down with `transform: scale()` to fit the available pane width (never scaled up above 100%). The zoom percentage is shown under the frame ("1440 × auto · 62%").
- Frame: white, `1px --border`, 8px radius, `shadow-sm`, centered on a `--surface` canvas with 24px padding. Tablet/mobile get a slightly thicker rounded "device" outline (12px radius / 20px radius) for recognisability. No fake phone graphics.
- Refresh button (⟳) re-mounts the iframe (useful for scripts/animations). A small "Live" pill shows that the preview updates as you type (debounced 300ms).
- Script errors from the iframe are shown as a small red counter under the frame; click to see messages.
- **Elementor templates:** the preview pane shows the feature image instead of a live render, with a note: "Elementor templates can't be rendered live. Swaps are applied to the JSON."

**Palette pane (right, 320px)** — tabs **Colors · Images · Fonts**

_Colors tab_

- List of detected colors, grouped by normalized value, sorted by occurrence count (desc).
- Row: swatch (28×28, checkerboard, 6px radius) · value in `code` style (hex, or `rgba` if transparent) · format chips (e.g. `hex ×8`, `rgb ×2`, `var(--brand)`) · count badge · chevron to expand.
- Click swatch → popover color picker (shadcn Popover + `react-colorful`) with hex/rgb/hsl inputs and the current preset colors as quick picks. Changing it updates **all** occurrences instantly in code and preview.
- Changed rows show `old → new` (two swatches with an arrow) and a "Reset" icon button.
- Expanded row lists each occurrence (line number + 40-char snippet with the color highlighted) with a checkbox; untick to exclude that occurrence from the swap. Clicking a snippet scrolls Monaco to that line.
- Footer actions: **Apply preset** (opens mapping dialog), **Save as preset**, **Reset all**.

_Images tab_

- Grid of detected image URLs (2 columns): thumbnail (16:10, cover), occurrence count, source type (`img`, `srcset`, `css url()`, `Elementor`).
- Click → "Replace image" popover with a single URL input (paste link only, no uploads), live thumbnail validation, and Apply. Invalid/broken URL → warning but still allowed (user may know better).
- `data:` URIs and relative paths shown with a warning badge.

_Fonts tab_

- Detected font families with count and where found (`font-family`, Google Fonts link, Elementor typography). Each row shows the name rendered in Inter (not in the font itself, to avoid loading fonts in the app).
- Replace via a combobox: free text + Google Fonts suggestions. If the template loads the font from Google Fonts, the link is updated too (shown as a note).

**Preset mapping dialog** (Apply preset)

- Left column: template's detected colors (old). Right column: dropdown per row to pick a preset color (new) or "Keep". Auto-suggest fills mappings by matching order of usage (most used → first preset color). Live preview updates while mapping. [Cancel] [Apply mapping].

**Save as variation dialog**

- Name input (required, autofocused, e.g. "Robo website section"), optional "Used in" note, and for Custom: feature image option (auto screenshot of current desktop preview / keep template image / upload).
- Summary of changes: "3 colors, 1 image, 1 font changed".
- Primary "Save variation". After save: success toast with "Copy code" action, and the editor's Base switches to the new variation.

**History sheet** (right side sheet, 420px; full screen on mobile)

- Timeline list of variations (newest first) with name, date, swatch strip, based-on label and change summary.
- Actions per item: Open (load as base), Copy code / Download .json, Compare with current (Phase 7, side-by-side diff in Monaco diff editor).

**Tablet (768–1279px):** two panes: Code | Preview, palette opens as a right sheet from a "Palette" button in the top bar.

**Mobile (< 768px):** single pane with a bottom tab bar: **Code · Preview · Palette**. Device control defaults to 375 on mobile. Save button stays in the top bar.

### 7.6 Palettes — `/palettes`

- Grid of preset cards: name, a 5–8 swatch strip (40px tall, rounded), color count, "used N times", ⋯ (Rename, Edit colors, Duplicate, Delete).
- Create/edit dialog: name + list of colors (add / remove / reorder by drag / optional label like "Primary").

### 7.7 Trash — `/trash`

- List of deleted templates and variations with deletion date (muted). Items stay until restored or deleted by hand (no auto-delete).
- Actions: Restore (secondary), Delete permanently (destructive, with a confirm dialog that names the item). "Empty trash" at top-right (destructive, confirm).

### 7.8 Settings — `/settings`

Sections in a left sub-nav (top tabs on mobile):

- **Tags:** table of tags (color dot, name, template count). Inline rename, color picker from 10 preset tag colors, delete (removes the tag from all its templates; the confirm dialog shows how many templates use it).
- **Account:** email, change password, sign out.
- **Backup:** "Export full library" button → downloads a `.zip`. Shows last export date. (Import in a later phase.)
- **Preferences:** default device for preview, default feature-image mode.

---

## 8. Components (shadcn/ui based)

| Component         | Notes                                                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button            | Variants: `primary` (indigo), `secondary` (white + border + shadow-xs), `ghost`, `destructive`, `link`. Sizes `sm` 32px, `md` 36px, `lg` 40px. Loading state: spinner replaces icon, button keeps its width, disabled. |
| Input / Textarea  | 36px tall, `1px --border`, `shadow-xs`, focus: `--primary` border + 3px ring at 20% opacity. Error: `--destructive` border + message below in `small`.                                                                 |
| Select / Combobox | shadcn `Select` and `Command`-based combobox for tags and fonts.                                                                                                                                                       |
| Badge             | Pill, `caption` text, soft background variants (primary, success, warning, destructive, neutral, type badges).                                                                                                         |
| Tag pill          | Small dot in the tag color + name, neutral `--surface-2` background. Tag colors are only used for the dot.                                                                                                             |
| Card              | White, border, 12px radius, 16px/20px padding.                                                                                                                                                                         |
| Dialog            | Max width 480px (forms) or 720px (mapping), `shadow-lg`, overlay `rgb(15 23 42 / 0.4)`. Full screen on mobile.                                                                                                         |
| Sheet             | Right side 420px, bottom sheet on mobile.                                                                                                                                                                              |
| Tabs              | Underline style for page sections; segmented style for device switcher and Code/Preview on mobile.                                                                                                                     |
| Tooltip           | Dark tooltip is allowed as the only dark surface: `#0F172A` bg, white `caption` text, 6px radius.                                                                                                                      |
| Toast             | `sonner`, top-right on desktop, top-center on mobile, white with left color bar. Auto-dismiss 4s; errors stay until closed.                                                                                            |
| Skeleton          | `--surface-2` with a soft shimmer; used for cards, rows and the preview while loading.                                                                                                                                 |
| Swatch            | Checkerboard bg, 1px border, 6px radius; sizes 16 / 28 / 40px. Always has a text value next to it or in a tooltip (never color alone).                                                                                 |
| Empty state       | Icon in a 48px `--surface` circle, `h3` title, one-line muted text, one primary action.                                                                                                                                |
| Confirm dialog    | Title states the action ("Move 'Hero dark' to trash?"), body states the consequence, destructive button names the action.                                                                                              |

---

## 9. States & feedback

- **Loading:** skeletons for first load; inline spinners for actions; never block the whole screen except during initial auth check.
- **Saving:** Save button shows spinner + "Saving…"; on success toast "Variation 'Robo website section' saved" with a "Copy code" action.
- **Copy:** Copy button switches to a check icon + "Copied" for 1.5s.
- **Errors:** human sentence + what to do next ("Couldn't save. Check your connection and try again."). Technical details only in a collapsible "Details".
- **Unsaved changes:** amber dot in editor top bar; browser `beforeunload` warning.
- **Optimistic UI** for favorites and tag edits; roll back with an error toast on failure.

---

## 10. Accessibility

- Every interactive element is reachable by keyboard with a visible focus ring (`--ring`, 2px offset).
- All icon buttons have `aria-label`; swatches have the color value as accessible text.
- Dialogs trap focus and return focus on close (shadcn/Radix default — do not override).
- Do not rely on color alone: changed colors show "old → new" text; errors have icons and text.
- Minimum 14px for body text; 12px only for captions/badges.
- Keyboard shortcuts: `⌘/Ctrl+K` search, `⌘/Ctrl+S` save variation, `1/2/3` switch device in preview (when focus is not in the editor), `Esc` closes dialogs/sheets.

---

## 11. Do / Don't

| Do                                                      | Don't                                                    |
| ------------------------------------------------------- | -------------------------------------------------------- |
| Use tokens and Tailwind scale                           | Hard-code random hex values or pixel sizes in components |
| Keep the UI neutral so template colors stand out        | Add colored backgrounds to page sections                 |
| Use Inter for all UI text, JetBrains Mono for code only | Load any other fonts into the app shell                  |
| Show counts and old → new for every swap                | Change user content silently                             |
| Make destructive actions reversible (trash)             | Hard-delete without confirmation                         |
| Test every screen at 375 / 768 / 1024 / 1440            | Ship a screen only checked on desktop                    |
| Keep the preview iframe fully isolated                  | Inject app CSS or fonts into the preview                 |
