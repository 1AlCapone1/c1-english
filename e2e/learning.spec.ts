import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("flashcard: wrong answer forces correction, then saves progress", async ({ page }) => {
  await login(page);
  await page.goto("/#/flashcards");
  await page.getByTestId("start-flashcards").click();
  // the words of the session are shown first
  await expect(page.getByTestId("word-preview")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("word-preview").locator("li").first()).toBeVisible();
  await page.getByTestId("preview-row").first().click();     // full card opens
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
test("skip and remove a word: preview, during flashcards, restore in settings", async ({ page }) => {
  await login(page);
  await page.goto("/#/flashcards");
  await page.getByTestId("start-flashcards").click();
  const preview = page.getByTestId("word-preview");
  await expect(preview).toBeVisible({ timeout: 20_000 });
  const before = await preview.locator("li").count();
  const firstTerm = (await preview.locator("li b").first().textContent())!.trim();
  await preview.getByTestId("preview-remove").first().click();               // remove in the preview
  await expect(page.getByTestId("removed-notice")).toContainText(firstTerm);
  await expect(preview.locator("li")).toHaveCount(before - 1);
  await page.getByTestId("removed-notice").getByRole("button", { name: "Cofnij" }).click();   // undo
  await expect(preview.locator("li")).toHaveCount(before);
  await page.getByTestId("preview-start").click();
  // during the session: "Pomiń" before answering, hidden once the correction loop started
  const counter = async () => Number((await page.getByText(/^Fiszka \d+ \/ \d+/).textContent())!.match(/\/ (\d+)/)![1]);
  await expect(page.getByTestId("skip")).toBeVisible();
  await page.getByTestId("skip").click();
  await expect(page.getByText(/^Fiszka 2 \//)).toBeVisible();
  await page.getByTestId("answer-input").fill("zzz wrong"); await page.keyboard.press("Enter");
  await expect(page.getByTestId("skip")).toHaveCount(0);                      // no skipping out of a correction
  await page.getByTestId("retype").click();
  await page.goto("/#/dashboard");
  await page.goto("/#/flashcards");
  await page.getByTestId("start-flashcards").click();
  await page.getByTestId("preview-start").click();
  const total = await counter();
  await page.getByTestId("remove-word").click();                              // remove during the session
  await expect(page.getByTestId("removed-notice")).toBeVisible();
  await expect.poll(counter).toBeLessThanOrEqual(total);
  // it is listed in settings and can be restored
  await page.goto("/#/settings");
  const hidden = page.getByTestId("hidden-words");
  await expect(hidden.locator("li").first()).toBeVisible({ timeout: 15_000 });
  const n = await hidden.locator("li").count();
  await hidden.getByRole("button", { name: "Przywróć" }).first().click();
  await expect(hidden.locator("li")).toHaveCount(n - 1);
  // clean up: restore everything so the test account keeps its full word pool
  for (let k = 1; k < n; k++) await hidden.getByRole("button", { name: "Przywróć" }).first().click();
  await expect(hidden.getByText("Brak wyrzuconych słów.")).toBeVisible({ timeout: 15_000 });
});
test("'Dobrze jest napisane – zalicz' accepts the learner's answer and reports it", async ({ page }) => {
  await login(page);
  await page.goto("/#/flashcards");
  await page.getByTestId("start-flashcards").click();
  await page.getByTestId("preview-start").click();
  const input = page.getByTestId("answer-input").first();
  await input.fill("my own variant"); await page.keyboard.press("Enter");
  await expect(page.getByTestId("accept-own")).toBeVisible();
  await page.getByTestId("accept-own").click();
  await expect(page.getByText("Zaliczone – Twoja odpowiedź")).toBeVisible();
  await expect(page.getByTestId("next")).toBeVisible();                    // can move on, no retyping
  // the report was stored for the admin; remove it again so test runs don't pile up
  const { createClient } = await import("@supabase/supabase-js");
  const c = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: process.env.E2E_USER_EMAIL!, password: process.env.E2E_USER_PASSWORD! });
  await expect.poll(async () => (await c.from("answer_reports").select("id").eq("user_answer", "my own variant")).data?.length ?? 0).toBeGreaterThan(0);
  await c.from("answer_reports").delete().eq("user_answer", "my own variant");
});
test("SRS: rating a correct answer schedules the next review, the SRS page shows the queue", async ({ page }) => {
  await login(page);
  await page.goto("/#/review");
  await expect(page.getByTestId("srs-page")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Prognoza powtórek – 14 dni")).toBeVisible();
  // flashcards Polish → English, so the preview tells us the answers
  await page.goto("/#/flashcards");
  await page.getByLabel("Rodzaj fiszki").selectOption("plen");
  await page.getByTestId("start-flashcards").click();
  const rows = page.getByTestId("preview-row");
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  const answers = new Map<string, string>();
  for (const r of await rows.all()) {
    const term = (await r.locator("b").first().textContent())!.trim();
    const pl = ((await r.locator("span.text-ink-soft").first().textContent()) ?? "").replace(/^–\s*/, "").trim();
    answers.set(pl, term);
  }
  await page.getByTestId("preview-start").click();
  // card 1 correct on the first try → rating with intervals
  const prompt = (await page.locator(".font-display.text-2xl").first().textContent())!.trim();
  await page.getByTestId("answer-input").fill(answers.get(prompt) ?? "??"); await page.keyboard.press("Enter");
  await expect(page.getByTestId("srs-rating")).toBeVisible();
  await expect(page.getByTestId("rate-easy")).toContainText(/za \d+ (dni|dzień)/);
  await expect(page.getByTestId("next")).toHaveCount(0);                       // must rate before moving on
  await page.keyboard.press("3");                                                // Łatwe
  await expect(page.getByText(/wróci za \d+ (dni|dzień)/)).toBeVisible();
  await expect(page.getByText(/^Fiszka 2 \//)).toBeVisible();
  // card 2 wrong → no rating, automatic "again"
  await page.getByTestId("answer-input").fill("zzz"); await page.keyboard.press("Enter");
  await expect(page.getByTestId("srs-rating")).toHaveCount(0);
  const right = (await page.getByTestId("correct-answer").textContent())!.trim();
  await page.keyboard.press("Enter"); await page.getByTestId("answer-input").fill(right); await page.keyboard.press("Enter");
  await expect(page.getByTestId("srs-again")).toBeVisible();
  // the review was logged in the database with the chosen grade
  const { createClient } = await import("@supabase/supabase-js");
  const c = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: process.env.E2E_USER_EMAIL!, password: process.env.E2E_USER_PASSWORD! });
  const { data } = await c.from("srs_reviews").select("grade, interval_after").order("reviewed_at", { ascending: false }).limit(2);
  expect(data?.map((r) => r.grade)).toEqual(["again", "easy"]);
  expect(Number(data?.[1].interval_after)).toBeGreaterThanOrEqual(1);
});
