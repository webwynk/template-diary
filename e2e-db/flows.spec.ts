import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { expectToast, signIn, templateIdFrom, typeCode } from "./helpers";

// Phase 11: the main flows, signed in, against a real (local) Supabase. One story, in order:
// preferences → Custom template → swap & save a variation → copy → palette preset applied in
// the editor → Elementor template → download → trash & restore → accessibility and layout.

const HTML =
  '<section class="hero"><style>.hero{background:#4f46e5;color:#ffffff;padding:40px}</style><h1>Hello E2E</h1></section>';
const ELEMENTOR_FIXTURE = path.join(
  __dirname,
  "..",
  "lib",
  "engine",
  "__tests__",
  "fixtures",
  "elementor-section.json",
);

let customId = "";
let elementorId = "";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the keep-alive ping reaches the database without a session", async ({ playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const res = await anon.get("/api/keep-alive", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  await anon.dispose();
});

test("preferences are saved and used by the new template form", async ({ page }) => {
  await page.goto("/settings/preferences");
  await page.getByRole("radio", { name: /Tablet/ }).check();
  await page.getByRole("radio", { name: "Upload my own image" }).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expectToast(page, "Preferences saved");

  await page.goto("/templates/new");
  await page.getByLabel("Name").fill("Prefs check");
  await page.getByRole("radio", { name: /Custom code/ }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("radio", { name: "Upload image" })).toBeChecked();
});

test("create a Custom template, swap a color and save it as a variation", async ({ page }) => {
  await page.goto("/templates/new");
  await page.getByLabel("Name").fill("E2E Hero");
  await page.getByRole("radio", { name: /Custom code/ }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await typeCode(page, HTML);
  // "Upload image" without a file: no screenshot is attempted in CI.
  await page.getByRole("radio", { name: "Upload image" }).check();
  await page.getByRole("button", { name: "Create template" }).click();

  await expect(page).toHaveURL(/\/templates\/[0-9a-f-]{36}\/edit/);
  customId = templateIdFrom(page.url());
  // The preview starts at the preferred device (Tablet, saved above).
  await expect(page.getByRole("radio", { name: "Tablet 768px" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await page.getByRole("button", { name: /^Change #4f46e5/i }).click();
  await page.getByLabel("Hex color").fill("#10b981");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Save as variation/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save as variation" });
  await dialog.getByLabel("Name").fill("Green");
  await dialog.getByRole("button", { name: "Save variation" }).click();
  await expectToast(page, "Variation “Green” saved");
});

test("copy a variation's code from the template page", async ({ page }) => {
  await page.goto(`/templates/${customId}`);
  const row = page.locator("li").filter({ hasText: "Green" }).first();
  await row.getByRole("button", { name: /Copy/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("#10b981");
});

test("create a palette and apply it in the editor", async ({ page }) => {
  await page.goto("/palettes");
  await page.getByRole("button", { name: "New palette" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("E2E palette");
  if ((await dialog.getByLabel("Hex for color 1").count()) === 0) {
    await dialog.getByRole("button", { name: "Add color" }).click();
  }
  await dialog.getByLabel("Hex for color 1").fill("#123456");
  await dialog.getByRole("button", { name: "Create palette" }).click();
  await expect(page.getByText("E2E palette").first()).toBeVisible();

  await page.goto(`/templates/${customId}/edit`);
  await page.getByRole("button", { name: "Apply preset" }).click();
  const panel = page.getByRole("dialog", { name: "Apply preset" });
  await panel.getByLabel("Palette").selectOption({ label: "E2E palette (1 color)" });
  await panel.getByRole("button", { name: "Apply mapping" }).click();
  await page.getByRole("button", { name: /Save as variation/ }).click();
  const save = page.getByRole("dialog", { name: "Save as variation" });
  await save.getByLabel("Name").fill("Navy");
  await save.getByRole("button", { name: "Save variation" }).click();
  await expectToast(page, "Variation “Navy” saved");
});

test("create an Elementor template and download its .json", async ({ page }) => {
  await page.goto("/templates/new");
  await page.getByLabel("Name").fill("E2E Section");
  await page.getByRole("radio", { name: /Elementor/ }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .locator('input[type="file"][accept=".json,application/json"]')
    .setInputFiles(ELEMENTOR_FIXTURE);
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page).toHaveURL(/\/templates\/[0-9a-f-]{36}\/edit/);
  elementorId = templateIdFrom(page.url());

  await page.goto(`/templates/${elementorId}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .locator("li")
      .filter({ hasText: "Original" })
      .getByRole("link", { name: /Download/ })
      .or(
        page
          .locator("li")
          .filter({ hasText: "Original" })
          .getByRole("button", { name: /Download/ }),
      )
      .first()
      .click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});

test("move a template to the trash and restore it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "More actions for E2E Section" }).click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await expectToast(page, "“E2E Section” moved to the trash");
  await expect(page.getByRole("link", { name: "E2E Section" })).toHaveCount(0);

  await page.goto("/trash");
  await page.getByRole("button", { name: "Restore E2E Section" }).click();
  await expectToast(page, "“E2E Section” restored");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "E2E Section" }).first()).toBeVisible();
});

function pages(): string[] {
  return [
    "/",
    "/favorites",
    "/palettes",
    "/trash",
    "/settings/tags",
    "/settings/account",
    "/settings/preferences",
    "/templates/new",
    `/templates/${customId}`,
    `/templates/${customId}/edit`,
  ];
}

async function settle(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

test("no accessibility violations (WCAG 2 A/AA) on the main pages", async ({ page }) => {
  const problems: string[] = [];
  for (const url of pages()) {
    await settle(page, url);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Monaco and the sandboxed template preview are third-party / user content.
      .exclude(".monaco-editor")
      .exclude("iframe")
      .analyze();
    for (const v of violations) {
      problems.push(
        `${url}: ${v.id} (${v.impact}) ${v.help} → ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
      );
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("no sideways scrolling at 375, 768, 1024 and 1440 px", async ({ page }) => {
  const problems: string[] = [];
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of pages()) {
      await settle(page, url);
      const { overflow, culprits } = await page.evaluate(() => {
        const root = document.documentElement;
        const w = root.clientWidth;
        const culprits: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > w + 1) {
            const cls = (el.getAttribute("class") ?? "").slice(0, 80);
            culprits.push(`${el.tagName.toLowerCase()}.${cls} (right ${Math.round(r.right)})`);
          }
        }
        return { overflow: root.scrollWidth - w, culprits: culprits.slice(-3) };
      });
      if (overflow > 1) {
        problems.push(`${url} at ${width}px overflows by ${overflow}px: ${culprits.join(" | ")}`);
      }
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});
