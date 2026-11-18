import { expect, test } from "@playwright/test";

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
