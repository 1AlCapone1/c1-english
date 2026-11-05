import { test, expect } from "@playwright/test";
import { login } from "./helpers";

for (const path of ["/#/dashboard", "/#/vocabulary", "/#/grammar", "/#/tests", "/#/mistakes", "/#/progress"]) {
  test(`no horizontal scroll on ${path}`, async ({ page }) => {
    await login(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
