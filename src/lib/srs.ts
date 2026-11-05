// Spaced repetition (Leitner boxes with expanding intervals)
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16, 32, 64, 120];
export type SrsState = { box: number; correct: number; wrong: number };

export function nextState(prev: SrsState | null, firstTryCorrect: boolean, hinted = false, now = Date.now()) {
  const s: SrsState = prev ? { ...prev } : { box: 0, correct: 0, wrong: 0 };
  if (firstTryCorrect) {
    s.correct++;
    if (!hinted) s.box = Math.min(s.box + 1, INTERVAL_DAYS.length - 1);
    const days = INTERVAL_DAYS[Math.max(1, s.box)];
    return { ...s, due_at: new Date(now + days * 86400000).toISOString() };
  }
  s.wrong++;
  s.box = 0;
  return { ...s, due_at: new Date(now + 10 * 60000).toISOString() };
}

export type CardStatus = "new" | "learning" | "due" | "hard" | "mastered";
export function cardStatus(p: { box: number; correct: number; wrong: number; due_at: string } | undefined, now = Date.now()): CardStatus {
  if (!p) return "new";
  if (p.box >= 4) return "mastered";
  if (p.wrong >= 2 && p.box < 3 && p.wrong > p.correct / 2) return "hard";
  if (new Date(p.due_at).getTime() <= now) return "due";
  return "learning";
}
export const STATUS_LABEL: Record<CardStatus, string> = { new: "nowe", learning: "w nauce", due: "do powtórki", hard: "trudne", mastered: "opanowane" };
