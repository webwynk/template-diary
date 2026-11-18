import { expect, test } from "@playwright/test";

test("home page renders in Inter on white with no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Template Diary" })).toBeVisible();

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
