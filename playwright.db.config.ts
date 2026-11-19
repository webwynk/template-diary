import { defineConfig, devices } from "@playwright/test";

// Signed-in end-to-end tests (Phase 11) against a local Supabase started by the CI job
// "e2e-db" (supabase start + a test user). They share one database, so they run in order.
// Local run: start Supabase, export NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
// ALLOWED_EMAIL / E2E_PASSWORD, `npm run build`, then `npx playwright test -c playwright.db.config.ts`.
const PORT = 3101;

export default defineConfig({
  testDir: "./e2e-db",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
