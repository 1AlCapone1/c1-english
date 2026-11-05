import { test, expect } from "@playwright/test";

/**
 * Real verification flow against Supabase. Runs only when tokens are provided
 * (workflow "Verify e-mail flow", inputs created with supabase/tests/verification_fixtures.sql).
 * The address is the public app URL, so this checks the deployed version.
 */
const T = {
  okDesktop: process.env.VERIFY_TOKEN_DESKTOP, okMobile: process.env.VERIFY_TOKEN_MOBILE, expired: process.env.VERIFY_TOKEN_EXPIRED,
  emailDesktop: process.env.VERIFY_EMAIL_DESKTOP, emailMobile: process.env.VERIFY_EMAIL_MOBILE, password: process.env.VERIFY_PASSWORD,
};
test.skip(!T.okDesktop, "verification tokens not provided");

const link = (token: string, type = "email") => `./?token_hash=${token}&type=${type}`;

test("valid link → 'Potwierdź weryfikację' → success → app works → reused link is rejected", async ({ page, isMobile }) => {
  const token = isMobile ? T.okMobile! : T.okDesktop!;
  const email = isMobile ? T.emailMobile! : T.emailDesktop!;
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(link(token));
  await expect(page).toHaveURL(/#\/auth\/confirm$/);           // token removed from the address bar
  expect(page.url()).not.toContain("token_hash");
  await page.getByTestId("confirm-button").click();
  await expect(page.getByRole("heading", { name: "Konto zostało pomyślnie zweryfikowane" })).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("confirm-continue").click();
  await expect(page).toHaveURL(/#\/dashboard/);
  await expect(page.getByText("Seria dni nauki")).toBeVisible({ timeout: 20_000 });
  // the app is usable: open the vocabulary module
  await page.goto("./#/vocabulary");
  await expect(page.getByRole("heading", { name: "Słownictwo" })).toBeVisible({ timeout: 20_000 });
  // log out, log in again with the verified account
  await page.evaluate(() => { Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k)); });
  await page.goto("./#/login");
  await page.reload(); // drop the in-memory session too
  await expect(page.getByTestId("email")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill(T.password!);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 20_000 });
  // the same link a second time
  await page.goto(link(token));
  await page.getByTestId("confirm-button").click();
  await expect(page.getByTestId("confirm-state")).toHaveAttribute("data-state", /^(already|expired)$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /już zweryfikowane|wygasł lub został już użyty/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("expired link shows a message and a resend form", async ({ page }) => {
  test.skip(!T.expired, "no expired token");
  await page.goto(link(T.expired!));
  await page.getByTestId("confirm-button").click();
  await expect(page.getByRole("heading", { name: "Link wygasł lub został już użyty" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("resend-form")).toBeVisible();
});

test("malformed token shows 'invalid link' without calling the server", async ({ page }) => {
  await page.goto(link("not-a-real-token"));
  await expect(page.getByRole("heading", { name: "Nieprawidłowy link weryfikacyjny" })).toBeVisible();
  await expect(page.getByTestId("resend-form")).toBeVisible();
});

test("unknown token is rejected by the server with a clear message", async ({ page }) => {
  await page.goto(link("0".repeat(56)));
  await page.getByTestId("confirm-button").click();
  await expect(page.getByTestId("confirm-state")).toHaveAttribute("data-state", /^(expired|invalid)$/, { timeout: 20_000 });
});

test("Supabase error redirect in the fragment is not a blank page or 404", async ({ page }) => {
  await page.goto("./#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.getByRole("heading", { name: "Link wygasł lub został już użyty" })).toBeVisible();
  await expect(page.getByText("Nie ma takiej strony")).toHaveCount(0);
});

test("PKCE code opened on another device → told the account is verified, asked to log in", async ({ page }) => {
  await page.goto("./?code=00000000-0000-0000-0000-000000000000");
  await expect(page.getByTestId("confirm-state")).toHaveAttribute("data-state", /^(other_device|expired)$/, { timeout: 20_000 });
  await expect(page.getByTestId("confirm-login")).toBeVisible();
});

test("confirm page without parameters explains what to do", async ({ page }) => {
  await page.goto("./#/auth/confirm");
  await expect(page.getByTestId("confirm-state")).toHaveAttribute("data-state", "nolink");
  await expect(page.getByTestId("resend-form")).toBeVisible();
});
