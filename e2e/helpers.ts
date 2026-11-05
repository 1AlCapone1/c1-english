import { expect, type Page } from "@playwright/test";
export const U1 = { email: process.env.E2E_USER_EMAIL!, password: process.env.E2E_USER_PASSWORD! };
export const U2 = { email: process.env.E2E_USER2_EMAIL!, password: process.env.E2E_USER2_PASSWORD! };
export async function login(page: Page, u = U1) {
  await page.goto("/#/login");
  await page.getByTestId("email").fill(u.email);
  await page.getByTestId("password").fill(u.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 20_000 });
}
