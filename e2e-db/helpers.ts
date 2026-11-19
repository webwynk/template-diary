import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const EMAIL = process.env.ALLOWED_EMAIL ?? "owner@example.com";
export const PASSWORD = process.env.E2E_PASSWORD ?? "e2e-password-123";

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Types into the Monaco code box (the first one on the page). */
export async function typeCode(page: Page, code: string) {
  const editor = page.locator(".monaco-editor").first();
  await editor.waitFor();
  await editor.click();
  await page.keyboard.insertText(code);
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

/** The id from /templates/<id>/edit (or /templates/<id>). */
export function templateIdFrom(url: string): string {
  const m = url.match(/\/templates\/([0-9a-f-]{36})/);
  if (!m) throw new Error(`No template id in ${url}`);
  return m[1]!;
}
