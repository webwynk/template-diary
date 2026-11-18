# Template Diary

A private, online library of website templates (Custom HTML/CSS/JS and Elementor `.json`) for one WordPress developer: detect colors, images and fonts, swap them globally with a live preview, and save named variations.

- Design system: [DESIGN.md](./DESIGN.md)
- Phase plan and database schema: [DEVELOPMENT.md](./DEVELOPMENT.md)
- Engineering rules: [RULES.md](./RULES.md)

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Radix) · Supabase · Monaco · Vercel

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local   # fill in values (needed from Phase 1)
npm run dev                  # http://localhost:3000
```

## Scripts

| Command                          | What it does                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Start the dev server                                                                                |
| `npm run check`                  | Typecheck, lint, format check, unit tests and production build. Run before every push.              |
| `npm run test`                   | Unit tests (Vitest)                                                                                 |
| `npm run test:e2e`               | End-to-end tests (Playwright) at 1440 / 768 / 375 px. First time: `npx playwright install chromium` |
| `npm run format`                 | Format all files with Prettier                                                                      |
| `node scripts/add-ui.mjs <name>` | Add a shadcn/ui component (see the script header)                                                   |

## Workflow

All work happens on `main`. Every push must pass `npm run check`. GitHub Actions runs the same checks plus the e2e tests on each push, and Vercel deploys `main`.
