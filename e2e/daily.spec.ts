import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, U1, U2 } from "./helpers";

/** Full daily lesson driven only with the keyboard (Enter, letter keys). Desktop uses user 1, phone uses user 2. */
const url = process.env.VITE_SUPABASE_URL!, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
async function resetTodaysPlan(u: { email: string; password: string }) {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword(u); if (error) throw error;
  await c.from("daily_plans").delete().gte("day", "2000-01-01"); // RLS: only this user's own plans
}
const stage = (page: Page) => page.getByTestId("daily").getAttribute("data-stage");
async function counter(page: Page) { const t = await page.getByText(/· \d+ \/ \d+/).first().textContent(); const m = t?.match(/(\d+) \/ (\d+)/); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; }

/** Answers every task with Enter only: wrong answer → correction → retype → correct → Enter to continue. */
async function solveSession(page: Page) {
  for (let guard = 0; guard < 60; guard++) {
    if (await page.getByTestId("session-close").isVisible()) return;
    const [before] = await counter(page);
    const isWord = /angielski odpowiednik|brakujące słowo|pasuje do definicji/.test(await page.locator("main").innerText());
    // daily lesson: only short answers – no sentence translation fields
    await expect(page.locator("main textarea")).toHaveCount(0);
    const input = page.getByTestId("answer-input");
    if (await input.count()) {
      // empty Enter must do nothing
      await input.focus(); await page.keyboard.press("Enter");
      await expect(page.getByText(/^Wpisz odpowiedź/)).toBeVisible();
      await input.fill("zzz wrong"); await page.keyboard.press("Enter");
      const right = (await page.getByTestId("correct-answer").textContent())!.trim();
      expect(right.split(/\s+/).length, `short answer expected, got "${right}"`).toBeLessThanOrEqual(6); // one word, phrase or fixed expression – never a sentence
      await expect(page.getByText(/Przetłumacz zdanie/)).toHaveCount(0);
      await page.keyboard.press("Enter");                                  // fix → retype
      await expect(page.getByText("Teraz wpisz poprawną odpowiedź z pamięci.")).toBeVisible();
      await input.fill(right); await page.keyboard.press("Enter");          // check again
    } else {
      await page.keyboard.press("a");                                       // choose option A
      if (await page.getByTestId("retype").isVisible()) {
        const right = (await page.getByTestId("correct-answer").textContent())!.trim();
        await page.keyboard.press("Enter");                                 // fix → choose again
        const opts = await page.locator("[data-option]").evaluateAll((els) => els.map((e) => e.getAttribute("data-option")));
        await page.keyboard.press("abcdef"[opts.indexOf(right)]);
      }
    }
    await expect(page.getByTestId("next")).toBeVisible();
    if (isWord) await expect(page.getByTestId("word-card")).toBeVisible();  // full word card after a word
    await page.keyboard.press("Enter");                                     // next item – exactly one step
    await expect.poll(async () => (await page.getByTestId("session-close").isVisible()) || (await counter(page))[0] !== before).toBe(true);
    if (await page.getByTestId("session-close").isVisible()) return;
    expect((await counter(page))[0]).toBe(before + 1);                     // never skips an item
  }
  throw new Error("session did not finish");
}

for (const [label, user] of [["desktop", U1], ["phone", U2]] as const) {
  test(`daily lesson order and Enter navigation (${label})`, async ({ page, isMobile }) => {
    test.skip(label === "phone" ? !isMobile : !!isMobile, "runs in its own project");
    test.setTimeout(240_000);
    await resetTodaysPlan(user);
    await login(page, user);
    await page.goto("./#/daily");
    // 1. vocabulary first, later stages locked
    await expect.poll(() => stage(page)).toBe("vocab");
    await expect(page.getByRole("heading", { name: "Słownictwo dnia" })).toBeVisible();
    await expect(page.getByTestId("stage-grammar")).toBeDisabled();
    await expect(page.getByTestId("stage-exercises")).toBeDisabled();
    await expect(page.getByText("Polski").first()).toBeVisible();
    await expect(page.getByTestId("stage-next")).toHaveText("Znam już te słowa – dalej");
    await page.keyboard.press("Enter");
    // 2. grammar second
    await expect.poll(() => stage(page)).toBe("grammar");
    await expect(page.getByRole("heading", { name: "Wyjaśnienie" })).toBeVisible();
    await expect(page.getByTestId("stage-exercises")).toBeDisabled();
    await expect(page.getByTestId("stage-next")).toHaveText("Rozumiem – dalej");
    await page.keyboard.press("Enter");
    // 3. exercises only now
    await expect.poll(() => stage(page)).toBe("exercises");
    await solveSession(page);
    await page.keyboard.press("Enter");                                     // summary of stage → next stage
    // 4. revision
    await expect.poll(() => stage(page)).toBe("revision");
    await solveSession(page);
    await page.keyboard.press("Enter");
    // summary
    await expect.poll(() => stage(page)).toBe("summary");
    await expect(page.getByRole("heading", { name: "Lekcja ukończona" })).toBeVisible();
    // optional extra round: new words → read → short answers → back to the summary
    await page.getByTestId("learn-more").click();
    await expect(page.getByTestId("extra-read")).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("extra-practice")).toBeVisible();
    await solveSession(page);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("extra-summary")).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/dashboard/);
    // progress saved in the database: plan row has all four stages, and word progress was recorded
    const c = createClient(url, key, { auth: { persistSession: false } });
    await c.auth.signInWithPassword(user);
    const { data: plans } = await c.from("daily_plans").select("stages, vocab_ids").order("day", { ascending: false }).limit(1);
    expect(Object.keys(plans?.[0]?.stages ?? {}).sort()).toEqual(["exercises", "extra", "grammar", "revision", "vocab"]);
    expect(plans?.[0]?.stages.extra).toHaveLength(1);
    const { count } = await c.from("flashcard_progress").select("vocab_id", { count: "exact", head: true }).in("vocab_id", plans![0].vocab_ids);
    expect(count).toBe(plans![0].vocab_ids.length);
    // reopening shows the summary
    await page.goto("./#/daily");
    await expect.poll(() => stage(page)).toBe("summary");
  });
}
