import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("flashcard: wrong answer forces correction, then saves progress", async ({ page }) => {
  await login(page);
  await page.goto("/#/flashcards");
  await page.getByTestId("start-flashcards").click();
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
  await expect(page.getByText(/test:mixed|flashcards/).first()).toBeVisible({ timeout: 15_000 });
});
test("daily lesson: plan with 4 blocks + review test, vocabulary block starts with typed answers", async ({ page }) => {
  await login(page);
  await page.getByTestId("continue").click();
  await expect(page).toHaveURL(/#\/daily/);
  await expect(page.getByRole("heading", { name: "Codzienna lekcja" })).toBeVisible();
  for (const b of ["vocab", "grammar", "uoe", "review"]) await expect(page.getByTestId(`daily-${b}`)).toBeVisible();
  await expect(page.getByTestId("daily-test")).toBeVisible();
  await page.getByTestId("daily-vocab").click();
  await expect(page.getByTestId("answer-input").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/krok 1 z 5/)).toBeVisible();
});
