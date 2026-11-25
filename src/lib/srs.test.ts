import { describe, it, expect } from "vitest";
import { schedule, autoGrade, formatInterval, emptyCard } from "./srs";

const NOW = Date.UTC(2026, 10, 25, 12);
const days = (s: { due_at: string }) => (new Date(s.due_at).getTime() - NOW) / 86400000;

describe("SM-2 scheduler", () => {
  it("first reviews: good = 1 day, then 3 days, then grows by ease", () => {
    const a = schedule(null, "good", NOW, 0.5);
    expect(days(a)).toBeCloseTo(1, 5);
    const b = schedule(a, "good", NOW, 0.5);
    expect(days(b)).toBeCloseTo(3, 5);
    const c = schedule(b, "good", NOW, 0.5);
    expect(days(c)).toBeCloseTo(7.5, 1); // 3 × 2.5
  });
  it("easy jumps further and raises ease; hard grows slowly and lowers ease", () => {
    const base = { ...emptyCard(), reps: 3, interval_days: 10, ease: 2.5 };
    const easy = schedule(base, "easy", NOW, 0.5), good = schedule(base, "good", NOW, 0.5), hard = schedule(base, "hard", NOW, 0.5);
    expect(days(easy)).toBeGreaterThan(days(good));
    expect(days(good)).toBeGreaterThan(days(hard));
    expect(days(hard)).toBeGreaterThanOrEqual(10);
    expect(easy.ease).toBeCloseTo(2.65, 5);
    expect(hard.ease).toBeCloseTo(2.35, 5);
  });
  it("again: back in 10 minutes, counts a lapse, lowers ease, resets reps", () => {
    const s = schedule({ ...emptyCard(), reps: 4, interval_days: 20, ease: 2.5 }, "again", NOW);
    expect((new Date(s.due_at).getTime() - NOW) / 60000).toBe(10);
    expect(s.lapses).toBe(1); expect(s.reps).toBe(0); expect(s.ease).toBeCloseTo(2.3, 5); expect(s.box).toBe(0);
  });
  it("ease never drops below 1.3 and intervals are capped at a year", () => {
    let s = { ...emptyCard(), ease: 1.35 };
    for (let k = 0; k < 5; k++) s = schedule(s, "again", NOW);
    expect(s.ease).toBe(1.3);
    const long = schedule({ ...emptyCard(), reps: 9, interval_days: 300, ease: 3.5 }, "easy", NOW, 1);
    expect(days(long)).toBeLessThanOrEqual(365);
  });
  it("typed answers map to grades", () => {
    expect(autoGrade(false, false)).toBe("again");
    expect(autoGrade(true, true)).toBe("hard");
    expect(autoGrade(true, false)).toBe("good");
  });
  it("formats intervals in Polish", () => {
    expect(formatInterval(schedule(null, "again", NOW), NOW)).toBe("10 min");
    expect(formatInterval(schedule(null, "good", NOW), NOW)).toBe("1 dzień");
    expect(formatInterval(schedule({ ...emptyCard(), reps: 1 }, "good", NOW), NOW)).toBe("3 dni");
  });
});
