// Spaced repetition – SM-2 style scheduler (as in Anki/SuperMemo):
// every card has an ease factor (how easy it is for you) and an interval (days until the next review).
// After each review you grade it: Again (forgot) / Hard / Good / Easy, and the next interval grows accordingly.
export type Grade = "again" | "hard" | "good" | "easy";
export const GRADE_LABEL: Record<Grade, string> = { again: "Nie pamiętam", hard: "Trudne", good: "Dobre", easy: "Łatwe" };
export type SrsCard = { box: number; correct: number; wrong: number; ease: number; interval_days: number; reps: number; lapses: number };
export type Scheduled = SrsCard & { due_at: string };

const MIN_EASE = 1.3, MAX_EASE = 3.5, MAX_INTERVAL = 365;
const RELEARN_MIN = 10; // minutes until a forgotten card comes back
// levels used elsewhere in the app (dashboard "mastered" = box ≥ 4 ≈ interval ≥ 8 days)
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16, 32, 64, 120];
export const boxFor = (interval: number) => { let b = 0; INTERVAL_DAYS.forEach((d, i) => { if (interval >= d && d > 0) b = i; }); return b; };

export const emptyCard = (): SrsCard => ({ box: 0, correct: 0, wrong: 0, ease: 2.5, interval_days: 0, reps: 0, lapses: 0 });
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Next state for a grade. `fuzz` (0..1) spreads reviews so cards learnt together don't all come back on one day. */
export function schedule(prev: Partial<SrsCard> | null, grade: Grade, now = Date.now(), fuzz = 0.5): Scheduled {
  const s: SrsCard = { ...emptyCard(), ...(prev ?? {}) };
  s.ease = Number(s.ease); s.interval_days = Number(s.interval_days);
  if (grade === "again") {
    s.wrong++; s.lapses++; s.reps = 0;
    s.ease = clamp(s.ease - 0.2, MIN_EASE, MAX_EASE);
    s.interval_days = 0;
    s.box = 0;
    return { ...s, ease: round2(s.ease), due_at: new Date(now + RELEARN_MIN * 60000).toISOString() };
  }
  s.correct++;
  let ivl: number;
  if (s.reps === 0) ivl = grade === "easy" ? 4 : grade === "good" ? 1 : 1;          // first successful review
  else if (s.reps === 1) ivl = grade === "easy" ? 6 : grade === "good" ? 3 : 2;     // second
  else {
    const base = Math.max(1, s.interval_days);
    ivl = grade === "hard" ? base * 1.2 : grade === "good" ? base * s.ease : base * s.ease * 1.3;
    ivl = Math.max(ivl, base + (grade === "hard" ? 0 : 1));                          // always move forward
  }
  if (grade === "hard") s.ease -= 0.15;
  if (grade === "easy") s.ease += 0.15;
  s.ease = clamp(s.ease, MIN_EASE, MAX_EASE);
  if (ivl > 2) ivl *= 1 + (fuzz - 0.5) * 0.1;                                          // ±5 %
  ivl = clamp(Math.round(ivl * 10) / 10, 1, MAX_INTERVAL);
  s.reps++; s.interval_days = ivl; s.box = boxFor(ivl);
  return { ...s, ease: round2(s.ease), due_at: new Date(now + ivl * 86400000).toISOString() };
}

/** Grade from a typed answer when the learner doesn't rate it: wrong → again, with hint → hard, correct → good. */
export const autoGrade = (firstTryCorrect: boolean, hinted: boolean): Grade => (!firstTryCorrect ? "again" : hinted ? "hard" : "good");

/** Kept for older callers: binary result → SM-2 step. */
export function nextState(prev: Partial<SrsCard> | null, firstTryCorrect: boolean, hinted = false, now = Date.now()) {
  return schedule(prev, autoGrade(firstTryCorrect, hinted), now, 0.5);
}

/** "za 10 min", "za 1 dzień", "za 3 tyg." */
export function formatInterval(s: Scheduled, now = Date.now()) {
  const min = (new Date(s.due_at).getTime() - now) / 60000;
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const d = min / 1440;
  if (d < 1.5) return "1 dzień";
  if (d < 30) return `${Math.round(d)} dni`;
  if (d < 365) return `${Math.round(d / 30)} mies.`;
  return `${(d / 365).toFixed(1)} roku`;
}

export type CardStatus = "new" | "learning" | "due" | "hard" | "mastered";
export function cardStatus(p: { box: number; correct: number; wrong: number; due_at: string; ease?: number; lapses?: number } | undefined, now = Date.now()): CardStatus {
  if (!p) return "new";
  if (new Date(p.due_at).getTime() <= now) return "due";
  if (p.box >= 4) return "mastered";
  if ((p.lapses ?? p.wrong) >= 2 && (p.ease ?? 2.5) < 2.0) return "hard";
  if (p.wrong >= 2 && p.box < 3 && p.wrong > p.correct / 2) return "hard";
  return "learning";
}
export const STATUS_LABEL: Record<CardStatus, string> = { new: "nowe", learning: "w nauce", due: "do powtórki", hard: "trudne", mastered: "opanowane" };
