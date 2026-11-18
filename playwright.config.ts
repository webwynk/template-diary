import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Placeholder Supabase settings: nothing listens at this URL. The e2e build must use the same
// values (CI sets them as job env), because NEXT_PUBLIC_* values are inlined at build time.
export const E2E_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder-anon-key-not-a-secret",
  ALLOWED_EMAIL: "owner@example.com",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
  },
  // DESIGN.md §5: every screen is checked at desktop, tablet and phone widths.
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: E2E_ENV,
    timeout: 120_000,
  },
});
