import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("protected pages redirect to login", async ({ page }) => {
  await page.goto("/#/dashboard");
  await expect(page).toHaveURL(/#\/login/);
});
test("wrong password shows a Polish error", async ({ page }) => {
  await page.goto("/#/login");
  await page.getByTestId("email").fill("nobody@example.com");
  await page.getByTestId("password").fill("wrong-password-1");
  await page.getByTestId("login-submit").click();
  await expect(page.getByText("Nieprawidłowy e-mail lub hasło.")).toBeVisible();
});
test("registration form validates input", async ({ page }) => {
  await page.goto("/#/register");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page.getByText(/min. 2 znaki/)).toBeVisible();
});
test("login persists after reload, dashboard shows real stats", async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page).toHaveURL(/#\/dashboard/);
  await expect(page.getByText("Seria dni nauki")).toBeVisible();
  await expect(page.getByTestId("continue")).toBeVisible();
});
test("normal user cannot open the admin panel by URL", async ({ page }) => {
  await login(page);
  await page.goto("/#/admin");
  await expect(page).toHaveURL(/#\/dashboard/);
});
test("password reset request is accepted", async ({ page }) => {
  await page.goto("/#/reset");
  await page.getByLabel("E-mail").fill("e2e-reset-check@example.com");
  await page.getByRole("button", { name: "Wyślij link" }).click();
  await expect(page.getByText(/Sprawdź skrzynkę|Zbyt wiele prób/)).toBeVisible({ timeout: 15_000 });
});
