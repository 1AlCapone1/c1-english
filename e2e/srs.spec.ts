import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./helpers";

/**
 * SRS + active writing, end to end with a dedicated account (user 3) whose SRS state is reset first:
 * answers are written from memory, checked, then rated Again/Hard/Good/Easy; the schedule in the database follows the rating.
 */
const U3 = { email: "e2e-user3@c1-english.test", password: process.env.E2E_USER_PASSWORD! };
const url = process.env.VITE_SUPABASE_URL!, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
async function db() { const c = createClient(url, key, { auth: { persistSession: false } }); const { error } = await c.auth.signInWithPassword(U3); if (error) throw error; return c; }
const counter = async (page: Page) => Number((await page.getByTestId("srs-counter").textContent())!.match(/Element (\d+)/)![1]);

test.skip(({ isMobile }) => isMobile, "desktop project only");

test("SRS session: write from memory, check, rate, schedule updates; typo vs error; summary", async ({ page }) => {
  test.setTimeout(180_000);
  const c = await db();
  const me = (await c.auth.getUser()).data.user!.id;
  for (const t of ["srs_reviews", "flashcard_progress", "exercise_progress", "mistakes", "vocab_hidden"]) await c.from(t).delete().eq("user_id", me);
  await c.from("profiles").update({ srs_new_per_day: 5 }).eq("id", me);

  await login(page, U3);
  await page.goto("/#/review");
  await expect(page.getByTestId("srs-due")).toHaveText("0", { timeout: 20_000 });
  await page.getByTestId("srs-start").click();
  // preview of the words; remember the answers (Polish → English)
  await expect(page.getByTestId("word-preview")).toBeVisible({ timeout: 20_000 });
  const map = new Map<string, string>();
  for (const row of await page.getByTestId("preview-row").all()) {
    const term = (await row.getByTestId("preview-term").textContent())!.trim();
    const pl = (await row.getByTestId("preview-pl").textContent())!.replace(/^–\s*/, "").split(";")[0].trim();
    map.set(pl, term);
  }
  expect(map.size).toBe(5);
  await page.keyboard.press("Enter");
  const input = () => page.getByTestId("answer-input");
  const prompt = async () => (await page.getByTestId("srs-prompt").textContent())!.trim();

  // 1) correct from memory → the answer is never shown before checking; rating offers all four; Easy → 4 days
  expect(await counter(page)).toBe(1);
  await expect(page.getByTestId("correct-answer")).toHaveCount(0);
  const a1 = map.get(await prompt())!;
  await input().fill(`  ${a1}  `); await page.keyboard.press("Enter");                 // spaces are ignored
  await expect(page.getByTestId("srs-rating")).toBeVisible();
  for (const g of ["again", "hard", "good", "easy"]) await expect(page.getByTestId(`rate-${g}`)).toBeEnabled();
  await expect(page.getByTestId("rate-easy")).toContainText("za 4 dni");
  await page.keyboard.press("4");
  await expect(page.getByTestId("srs-next-info")).toContainText("wróci za 4 dni");
  expect(await counter(page)).toBe(2);

  // 2) wrong → correction loop → only Again/Hard; Enter = Again → back in 10 min
  await input().fill("zzzz wrong"); await page.keyboard.press("Enter");
  await expect(page.getByTestId("srs-rating")).toHaveCount(0);                          // must fix first
  const right = (await page.getByTestId("correct-answer").textContent())!.trim();
  await page.keyboard.press("Enter"); await input().fill(right); await page.keyboard.press("Enter");
  await expect(page.getByTestId("rate-good")).toBeDisabled();
  await expect(page.getByTestId("rate-easy")).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("srs-next-info")).toContainText("wróci za 10 min");

  // 3) one-letter slip in a longer word = typo, accepted with the right spelling; Good
  let typoDone = false;
  for (let k = 0; k < 3 && !typoDone; k++) {
    const p = await prompt(); const ans = map.get(p);
    if (ans && ans.length >= 6 && !ans.includes(" ")) {
      const slip = ans.slice(0, 3) + (ans[3] === "x" ? "y" : "x") + ans.slice(4);   // one wrong letter in the middle
      await input().fill(slip); await page.keyboard.press("Enter");
      await expect(page.getByText("Zaliczone – drobna literówka")).toBeVisible();
      await page.keyboard.press("3"); typoDone = true;
    } else if (ans) { await input().fill(ans); await page.keyboard.press("Enter"); await page.keyboard.press("3"); }
    else break;
  }

  // finish the rest: words by the map, grammar by fixing
  for (let guard = 0; guard < 40; guard++) {
    if (await page.getByTestId("srs-summary").isVisible()) break;
    const p = await prompt(); const ans = map.get(p);
    if (ans) { await input().fill(ans); await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); }
    else {
      await input().fill("zzz"); await page.keyboard.press("Enter");
      const r = (await page.getByTestId("correct-answer").textContent())!.trim();
      await page.keyboard.press("Enter"); await input().fill(r); await page.keyboard.press("Enter");
      if (await page.getByTestId("srs-rating").isVisible()) await page.keyboard.press("Enter"); else await page.getByTestId("next").click();
    }
    await expect.poll(async () => (await page.getByTestId("srs-summary").isVisible()) || (await page.getByTestId("srs-rating").count()) === 0).toBe(true);
  }
  await expect(page.getByTestId("srs-summary")).toBeVisible();
  await expect(page.getByText("Wykonane ćwiczenia")).toBeVisible();
  expect(Number(await page.getByTestId("srs-sum-bad").textContent())).toBeGreaterThanOrEqual(1);
  await expect(page.getByText("Wymaga dodatkowej nauki")).toBeVisible();

  // the database follows the ratings
  const { data: rev } = await c.from("srs_reviews").select("grade, correct, vocab_id, exercise_id").eq("user_id", me).order("reviewed_at");
  expect(rev![0].grade).toBe("easy"); expect(rev![0].correct).toBe(true);
  expect(rev![1].grade).toBe("again"); expect(rev![1].correct).toBe(false);
  const { data: p1 } = await c.from("flashcard_progress").select("interval_days, ease").eq("vocab_id", rev![0].vocab_id).single();
  expect(Number(p1!.interval_days)).toBeGreaterThanOrEqual(3.5);
  expect(Number(p1!.ease)).toBeCloseTo(2.65, 2);
  const { data: p2 } = await c.from("flashcard_progress").select("interval_days, lapses, due_at").eq("vocab_id", rev![1].vocab_id).single();
  expect(Number(p2!.interval_days)).toBe(0); expect(p2!.lapses).toBe(1);
  expect(new Date(p2!.due_at).getTime() - Date.now()).toBeLessThan(11 * 60_000);
  // the failed word is due again soon and shows up in today's count
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("srs-due")).not.toHaveText("0", { timeout: 20_000 });
});
