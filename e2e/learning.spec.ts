import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("flashcard: wrong answer forces correction, then saves progress", async ({ page }) => {
  await login(page);
  await page.goto("/#/flashcards");
  await page.getByTestId("start-flashcards").click();
  // the words of the session are shown first
  await expect(page.getByTestId("word-preview")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("word-preview").locator("li").first()).toBeVisible();
  await page.getByTestId("word-preview").locator("li button").first().click();     // full card opens
  await expect(page.getByText("Wymowa").first()).toBeVisible();
  await page.getByTestId("preview-start").click();
  const input = page.getByTestId("answer-input").first();
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.fill("zzzz definitely wrong");
  await page.getByTestId("check").click();
  await expect(page.getByText(/^Błąd:/)).toBeVisible();
  await expect(page.getByTestId("next")).toHaveCount(0); // cannot move on
  await page.getByTestId("retype").click();
  await expect(page.getByText("Teraz wpisz poprawną odpowiedź z pamięci.")).toBeVisible();
  // a wrong retype shows a hint but still blocks
  await page.getByTestId("answer-input").fill("still wrong");
  await page.getByTestId("check").click();
  await expect(page.getByText(/Wskazówka:/)).toBeVisible();
  await expect(page.getByTestId("next")).toHaveCount(0);
});
test("test: answers are graded and stored in history", async ({ page }) => {
  await login(page);
  await page.goto("/#/tests");
  await page.getByLabel("Długość").selectOption("10");
  await page.getByTestId("start-test").click();
  await page.getByTestId("finish").click({ timeout: 20_000 });
  await page.getByTestId("finish-confirm").click();
  await expect(page.getByText(/0 poprawnych, 10 błędnych/)).toBeVisible();
  await expect(page.getByText("Wynik zapisano w historii")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "← Wróć do testów" }).click();
  await expect(page.getByRole("cell", { name: /Test mieszany/ }).first()).toBeVisible();
});
test("mistakes from the test appear in the Mistake Notebook", async ({ page }) => {
  await login(page);
  await page.goto("/#/mistakes");
  await expect(page.getByText(/test:mixed|flashcards|daily:/).first()).toBeVisible({ timeout: 15_000 });
});
test("dashboard button opens the daily lesson", async ({ page }) => {
  await login(page);
  await page.getByTestId("continue").click();
  await expect(page).toHaveURL(/#\/daily/);
  await expect(page.getByTestId("daily")).toBeVisible({ timeout: 20_000 });
});
test("tests: Enter moves to the next question and then asks to finish; Writing keeps Enter for new lines", async ({ page }) => {
  await login(page);
  await page.goto("/#/tests");
  await page.getByLabel("Długość").selectOption("10");
  await page.getByTestId("start-test").click();
  await expect(page.locator("[data-q='1']")).toBeVisible({ timeout: 20_000 });
  for (let n = 1; n <= 10; n++) {
    const q = page.locator(`[data-q='${n}']`);
    const text = q.locator("input:not([type=radio])");
    if (await text.count()) { await text.fill("x"); await text.press("Enter"); }
    else { await q.locator("input[type=radio]").first().check(); await q.locator("input[type=radio]").first().press("Enter"); }
    if (n < 10) await expect.poll(() => page.evaluate(() => document.activeElement?.closest("[data-q]")?.getAttribute("data-q"))).toBe(String(n + 1));
  }
  await expect(page.getByTestId("finish-confirm")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/poprawnych, \d+ błędnych/)).toBeVisible();
  // Writing: Enter inserts a new line, it does not submit anything
  await page.goto("/#/writing");
  await page.getByRole("button", { name: "Napisz", exact: true }).click();
  const area = page.getByLabel("Twój tekst");
  await area.click(); await page.keyboard.type("First line"); await page.keyboard.press("Enter"); await page.keyboard.type("Second line");
  await expect(area).toHaveValue("First line\nSecond line");
});
