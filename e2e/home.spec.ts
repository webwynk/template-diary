import { expect, test } from "@playwright/test";

import { MONACO_VS_PATH } from "../lib/monaco";

// These run against a build with placeholder Supabase settings (see playwright.config.ts),
// so they cover everything up to the real sign-in call.

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Template Diary" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
});

test("login page uses Inter on white with no horizontal scroll", async ({ page }) => {
  await page.goto("/login");
  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return {
      background: body.backgroundColor,
      fontFamily: body.fontFamily,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(styles.background).toBe("rgb(255, 255, 255)");
  expect(styles.fontFamily.toLowerCase()).toContain("inter");
  expect(styles.overflowX).toBe(false);
});

test("there is no sign-up link", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/sign up|create account|register/i)).toHaveCount(0);
});

test("a non-allowed email gets the generic error and keeps the typed email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-error")).toHaveText("Incorrect email or password.");
  await expect(page.getByLabel("Email")).toHaveValue("someone@example.com");
});

test("an invalid email is rejected before anything is sent", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("x");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-error")).toHaveText("Enter a valid email address.");
});

test("protected pages redirect to login when signed out", async ({ page }) => {
  for (const path of [
    "/settings",
    "/settings/tags",
    "/favorites",
    "/templates/new",
    "/templates/4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f",
    "/templates/4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f/edit",
    "/templates/4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f/edit?base=4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f",
    "/?view=list",
    "/?q=hero&type=custom&fav=1&sort=name",
    "/favorites",
    "/trash",
  ]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login$/);
  }
});

test("downloads need a session", async ({ request }) => {
  const res = await request.get("/api/variations/4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f/download", {
    maxRedirects: 0,
  });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toMatch(/\/login$/);
});

test("the code editor is served from our own domain without a session", async ({ request }) => {
  const res = await request.get(`${MONACO_VS_PATH}/loader.js`, { maxRedirects: 0 });
  expect(res.status()).toBe(200);
});

test("the trash purge cron refuses requests without its secret (and is not redirected)", async ({
  request,
}) => {
  for (const authorization of [undefined, "Bearer wrong-secret-value-123"]) {
    const res = await request.get("/api/cron/purge-trash", {
      maxRedirects: 0,
      headers: authorization ? { authorization } : {},
    });
    expect(res.status()).toBe(401);
  }
});
